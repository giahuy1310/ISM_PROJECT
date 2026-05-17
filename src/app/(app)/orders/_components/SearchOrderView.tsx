'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { OrderDetailDialog } from './OrderDetailDialog';

const PAGE_SIZE = 25;

type OrderRow = {
  RetailOrderID: number;
  OrderID: string;
  OrderDate: string;
  ShipDate: string | null;
  ShipStatus: string | null;
  Returned: string | null;
  CustomerID: string;
  ProductID: string;
  ShipMode: string | null;
  City: string | null;
  Region: string | null;
};

type ApiResponse = {
  data: OrderRow[];
  total: number;
  page: number;
  limit: number;
};

type FilterState = {
  retailOrderId: string;
  orderId: string;
  customerId: string;
  productId: string;
  shipModeId: string;
  location: string;
  retailSalesPeopleId: string;
  startDate: string;
  endDate: string;
  shipStartDate: string;
  shipEndDate: string;
  shipStatus: string;
  returned: string;
};

type DateFieldKey = 'startDate' | 'endDate' | 'shipStartDate' | 'shipEndDate';
type DateErrors = Partial<Record<DateFieldKey, string>>;

const defaultFilters: FilterState = {
  retailOrderId: '',
  orderId: '',
  customerId: '',
  productId: '',
  shipModeId: '',
  location: '',
  retailSalesPeopleId: '',
  startDate: '',
  endDate: '',
  shipStartDate: '',
  shipEndDate: '',
  shipStatus: '',
  returned: '',
};

function buildSearchParams(filters: FilterState, page: number) {
  const sp = new URLSearchParams();
  sp.set('page', String(page));
  sp.set('limit', String(PAGE_SIZE));

  (Object.keys(filters) as Array<keyof FilterState>).forEach((key) => {
    const value = (filters[key] ?? '').trim();
    if (value) sp.set(key, value);
  });

  return sp;
}

function parseDdMmYyyyToYmd(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const DATE_FORMAT_ERROR = 'date must be in dd/mm/yyyy';
const START_AFTER_END_ERROR = 'start date is later than end date';

function validateDateFields(filters: FilterState) {
  const errors: DateErrors = {};
  const keys: DateFieldKey[] = ['startDate', 'endDate', 'shipStartDate', 'shipEndDate'];

  keys.forEach((key) => {
    const value = filters[key].trim();
    if (!value) return;
    if (!parseDdMmYyyyToYmd(value)) errors[key] = DATE_FORMAT_ERROR;
  });

  function applyRangeOrder(startKey: DateFieldKey, endKey: DateFieldKey) {
    const startYmd = parseDdMmYyyyToYmd(filters[startKey]);
    const endYmd = parseDdMmYyyyToYmd(filters[endKey]);
    if (startYmd && endYmd && startYmd > endYmd) {
      errors[startKey] = START_AFTER_END_ERROR;
    }
  }
  applyRangeOrder('startDate', 'endDate');
  applyRangeOrder('shipStartDate', 'shipEndDate');

  return errors;
}

function normalizeDateRange(
  filters: FilterState,
  startField: 'startDate' | 'shipStartDate',
  endField: 'endDate' | 'shipEndDate',
) {
  const start = filters[startField].trim();
  const end = filters[endField].trim();

  if (start && !end) return { ...filters, [endField]: start };
  if (!start && end) return { ...filters, [startField]: end };
  return filters;
}

function toApiDateFilters(filters: FilterState) {
  const normalizedOrder = normalizeDateRange(filters, 'startDate', 'endDate');
  const normalizedShip = normalizeDateRange(normalizedOrder, 'shipStartDate', 'shipEndDate');

  return {
    ...normalizedShip,
    startDate: normalizedShip.startDate ? (parseDdMmYyyyToYmd(normalizedShip.startDate) ?? '') : '',
    endDate: normalizedShip.endDate ? (parseDdMmYyyyToYmd(normalizedShip.endDate) ?? '') : '',
    shipStartDate: normalizedShip.shipStartDate ? (parseDdMmYyyyToYmd(normalizedShip.shipStartDate) ?? '') : '',
    shipEndDate: normalizedShip.shipEndDate ? (parseDdMmYyyyToYmd(normalizedShip.shipEndDate) ?? '') : '',
  };
}

export function SearchOrderView() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [dateErrors, setDateErrors] = useState<DateErrors>({});
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const currentControllerRef = useRef<AbortController | null>(null);

  async function runSearch(page = 1) {
    const validationErrors = validateDateFields(filters);
    setDateErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setError('');
      return;
    }

    const normalizedFilters = normalizeDateRange(
      normalizeDateRange(filters, 'startDate', 'endDate'),
      'shipStartDate',
      'shipEndDate',
    );
    if (normalizedFilters !== filters) {
      setFilters(normalizedFilters);
    }
    const apiFilters = toApiDateFilters(normalizedFilters);

    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;
    currentControllerRef.current?.abort();
    const controller = new AbortController();
    currentControllerRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const params = buildSearchParams(apiFilters, page);
      const res = await fetch(`/api/orders?${params.toString()}`, { signal: controller.signal });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'Failed to search orders');
      }
      if (currentRequestId !== requestIdRef.current) return;
      setResult(json as ApiResponse);
      setActivePage(page);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (currentRequestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Search failed');
      setResult(null);
    } finally {
      if (currentRequestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }

  function onFilterChange(field: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function onDateFieldBlur(field: DateFieldKey) {
    const pairMap: Record<DateFieldKey, { start: DateFieldKey; end: DateFieldKey }> = {
      startDate: { start: 'startDate', end: 'endDate' },
      endDate: { start: 'startDate', end: 'endDate' },
      shipStartDate: { start: 'shipStartDate', end: 'shipEndDate' },
      shipEndDate: { start: 'shipStartDate', end: 'shipEndDate' },
    };

    setDateErrors((prev) => {
      const next = { ...prev };
      const value = filters[field].trim();
      if (value && !parseDdMmYyyyToYmd(value)) {
        next[field] = DATE_FORMAT_ERROR;
      } else {
        delete next[field];
      }

      const pair = pairMap[field];
      const startYmd = parseDdMmYyyyToYmd(filters[pair.start]);
      const endYmd = parseDdMmYyyyToYmd(filters[pair.end]);
      if (startYmd && endYmd && startYmd > endYmd) {
        next[pair.start] = START_AFTER_END_ERROR;
      } else if (next[pair.start] === START_AFTER_END_ERROR) {
        delete next[pair.start];
      }

      return next;
    });
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setDateErrors({});
    setResult(null);
    setActivePage(1);
    setError('');
  }

  const totalPages = useMemo(() => {
    if (!result) return 0;
    return Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  }, [result]);

  useEffect(() => {
    return () => currentControllerRef.current?.abort();
  }, []);

  return (
    <div className="space-y-6">
      <section className="bg-surface-container-lowest rounded-xl p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] space-y-4">
        <h2 className="text-lg font-headline font-bold text-on-surface">Search Orders</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Retail Order ID">
            <input className={inputClass} value={filters.retailOrderId} onChange={(e) => onFilterChange('retailOrderId', e.target.value)} />
          </Field>
          <Field label="Order ID">
            <input className={inputClass} value={filters.orderId} onChange={(e) => onFilterChange('orderId', e.target.value)} />
          </Field>
          <Field label="Customer ID">
            <input className={inputClass} value={filters.customerId} onChange={(e) => onFilterChange('customerId', e.target.value)} />
          </Field>
          <Field label="Product ID">
            <input className={inputClass} value={filters.productId} onChange={(e) => onFilterChange('productId', e.target.value)} />
          </Field>
          <Field label="Ship Mode ID">
            <input className={inputClass} value={filters.shipModeId} onChange={(e) => onFilterChange('shipModeId', e.target.value)} />
          </Field>
          <Field label="Location (postal code, region, state, country)">
            <input
              className={inputClass}
              value={filters.location ?? ''}
              placeholder="Type any: postal code, region, state, or country"
              onChange={(e) => onFilterChange('location', e.target.value)}
            />
          </Field>
          <Field label="Retail Sales People ID">
            <input className={inputClass} value={filters.retailSalesPeopleId} onChange={(e) => onFilterChange('retailSalesPeopleId', e.target.value)} />
          </Field>
          <DateRangeInput
            label="Order Date Range"
            startDate={filters.startDate}
            endDate={filters.endDate}
            startError={dateErrors.startDate}
            endError={dateErrors.endDate}
            onStartChange={(value) => onFilterChange('startDate', value)}
            onEndChange={(value) => onFilterChange('endDate', value)}
            onStartBlur={() => onDateFieldBlur('startDate')}
            onEndBlur={() => onDateFieldBlur('endDate')}
          />
          <DateRangeInput
            label="Ship Date Range"
            startDate={filters.shipStartDate}
            endDate={filters.shipEndDate}
            startError={dateErrors.shipStartDate}
            endError={dateErrors.shipEndDate}
            onStartChange={(value) => onFilterChange('shipStartDate', value)}
            onEndChange={(value) => onFilterChange('shipEndDate', value)}
            onStartBlur={() => onDateFieldBlur('shipStartDate')}
            onEndBlur={() => onDateFieldBlur('shipEndDate')}
          />
          <Field label="Ship Status">
            <select className={inputClass} value={filters.shipStatus} onChange={(e) => onFilterChange('shipStatus', e.target.value)}>
              <option value="">Any</option>
              <option value="On-Time">On-Time</option>
              <option value="Late">Late</option>
            </select>
          </Field>
          <Field label="Returned">
            <select className={inputClass} value={filters.returned} onChange={(e) => onFilterChange('returned', e.target.value)}>
              <option value="">Any</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runSearch(1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full px-5 h-9 text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50"
          >
            Search
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-full px-5 h-9 text-sm font-semibold bg-surface-container-high text-on-surface hover:opacity-90"
          >
            Clear
          </button>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-headline font-bold text-on-surface">Results</h3>
          <p className="text-xs text-on-surface-variant">
            {result ? `${result.total} record(s) found` : 'Run a search to view records'}
          </p>
        </div>

        {loading && <p className="text-sm text-on-surface-variant">Loading results...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && result && (
          <>
            <div className="overflow-x-auto rounded-lg border border-[rgba(196,198,204,0.2)]">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container-low text-on-surface-variant">
                  <tr>
                    <th className={thClass}>RetailOrderID</th>
                    <th className={thClass}>OrderID</th>
                    <th className={thClass}>OrderDate</th>
                    <th className={thClass}>ShipDate</th>
                    <th className={thClass}>ShipStatus</th>
                    <th className={thClass}>Returned</th>
                    <th className={thClass}>CustomerID</th>
                    <th className={thClass}>ProductID</th>
                    <th className={thClass}>ShipMode</th>
                    <th className={thClass}>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row) => (
                    <tr key={row.RetailOrderID} className="border-t border-[rgba(196,198,204,0.2)]">
                      <td className={tdClass}>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => setDetailId(row.RetailOrderID)}
                        >
                          {row.RetailOrderID}
                        </button>
                      </td>
                      <td className={tdClass}>{row.OrderID}</td>
                      <td className={tdClass}>{row.OrderDate}</td>
                      <td className={tdClass}>{row.ShipDate ?? '—'}</td>
                      <td className={tdClass}>{row.ShipStatus ?? '—'}</td>
                      <td className={tdClass}>{row.Returned ?? '—'}</td>
                      <td className={tdClass}>{row.CustomerID}</td>
                      <td className={tdClass}>{row.ProductID}</td>
                      <td className={tdClass}>{row.ShipMode ?? '—'}</td>
                      <td className={tdClass}>{row.Region ?? '—'}</td>
                    </tr>
                  ))}
                  {result.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-on-surface-variant" colSpan={10}>
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-on-surface-variant">
                Page {activePage} of {totalPages || 1} (25 per page)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runSearch(activePage - 1)}
                  disabled={loading || activePage <= 1}
                  className="rounded-full px-4 h-8 text-xs font-semibold bg-surface-container-high disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => runSearch(activePage + 1)}
                  disabled={loading || activePage >= totalPages}
                  className="rounded-full px-4 h-8 text-xs font-semibold bg-surface-container-high disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <OrderDetailDialog
        key={detailId ?? 'empty'}
        retailOrderId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

const inputClass =
  'w-full bg-surface-container-low border border-[rgba(196,198,204,0.2)] rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

function DateRangeInput({
  label,
  startDate,
  endDate,
  startError,
  endError,
  onStartChange,
  onEndChange,
  onStartBlur,
  onEndBlur,
}: {
  label: string;
  startDate: string;
  endDate: string;
  startError?: string;
  endError?: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
}) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            className={inputClass}
            placeholder="From (dd/mm/yyyy)"
            value={startDate}
            onChange={(e) => onStartChange(e.target.value)}
            onBlur={onStartBlur}
          />
          {startError && <p className="mt-1 text-xs text-red-500">{startError}</p>}
        </div>
        <div>
          <input
            className={inputClass}
            placeholder="To (dd/mm/yyyy)"
            value={endDate}
            onChange={(e) => onEndChange(e.target.value)}
            onBlur={onEndBlur}
          />
          {endError && <p className="mt-1 text-xs text-red-500">{endError}</p>}
        </div>
      </div>
    </Field>
  );
}

const thClass = 'px-3 py-2 text-left text-xs font-semibold whitespace-nowrap';
const tdClass = 'px-3 py-2 text-on-surface whitespace-nowrap';
