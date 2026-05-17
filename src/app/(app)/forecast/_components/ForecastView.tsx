'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ForecastPredictResponse, ForecastShipmentInput } from '@/lib/forecast/types';

type ShipMode = {
  ShipModeID: number;
  ShipMode: string;
};

type SalesPerson = {
  RetailSalesPeopleID: number;
  RetailSalesPeople: string;
};

type Customer = {
  CustomerID: string;
  CustomerName: string;
  CusSegmentID: number;
  Segment: string;
};

type Product = {
  ProductID: string;
  ProductName: string;
  SubCategoryID: number;
  SubCategory: string;
  CategoryID: number;
  Category: string;
  UnitCP?: number | string | null;
  UnitSP?: number | string | null;
};

type LocationOption = {
  PostalCode: string | number;
  City: string;
  State: string;
  Region: string;
  Country: string;
  longitude?: number;
  latitude?: number;
  Longitude?: number;
  Latitude?: number;
};

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCoord(location: LocationOption, key: 'longitude' | 'latitude'): number | null {
  const lower = location[key];
  if (typeof lower === 'number' && Number.isFinite(lower)) return lower;
  const upper = key === 'longitude' ? location.Longitude : location.Latitude;
  if (typeof upper === 'number' && Number.isFinite(upper)) return upper;
  return null;
}

const defaultForm = {
  orderDate: todayIsoDate(),
  sales: '',
  quantity: '1',
  profit: '',
};

export function ForecastView() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(true);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastPredictResponse | null>(null);
  const [shipModes, setShipModes] = useState<ShipMode[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedShipModeId, setSelectedShipModeId] = useState<number | null>(null);
  const [selectedSalesPeopleId, setSelectedSalesPeopleId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [postalSearch, setPostalSearch] = useState('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      try {
        const [lookupRes, custRes, prodRes] = await Promise.all([
          fetch('/api/orders/lookup'),
          fetch('/api/customers?limit=500'),
          fetch('/api/products?limit=500'),
        ]);

        if (!lookupRes.ok || !custRes.ok || !prodRes.ok) {
          throw new Error('Failed to load lookup data');
        }

        const lookup = (await lookupRes.json()) as { shipModes?: ShipMode[]; salesPeople?: SalesPerson[] };
        const customerData = (await custRes.json()) as { data?: Customer[] };
        const productData = (await prodRes.json()) as { data?: Product[] };
        if (!cancelled) {
          setShipModes(lookup.shipModes ?? []);
          setSalesPeople(lookup.salesPeople ?? []);
          setCustomers(customerData.data ?? []);
          setProducts(productData.data ?? []);
          setSelectedShipModeId(lookup.shipModes?.[0]?.ShipModeID ?? null);
          setSelectedSalesPeopleId(lookup.salesPeople?.[0]?.RetailSalesPeopleID ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load form options');
        }
      } finally {
        if (!cancelled) setLoadingLookup(false);
      }
    }

    loadLookups();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showLocationSuggestions) {
      setSearchingLocation(false);
      return;
    }
    if (postalSearch.trim().length < 1) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        const res = await fetch(`/api/locations?q=${encodeURIComponent(postalSearch.trim())}`);
        const json = (await res.json()) as LocationOption[];
        if (!cancelled) {
          setLocations(Array.isArray(json) ? json : []);
        }
      } catch {
        if (!cancelled) setLocations([]);
      } finally {
        if (!cancelled) setSearchingLocation(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [postalSearch, showLocationSuggestions]);

  const selectedShipMode = useMemo(
    () => shipModes.find((m) => m.ShipModeID === selectedShipModeId) ?? null,
    [shipModes, selectedShipModeId],
  );
  const selectedSalesPerson = useMemo(
    () => salesPeople.find((s) => s.RetailSalesPeopleID === selectedSalesPeopleId) ?? null,
    [salesPeople, selectedSalesPeopleId],
  );
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.CustomerID === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );
  const selectedProduct = useMemo(
    () => products.find((p) => p.ProductID === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  useEffect(() => {
    const qty = numberOrNull(form.quantity);
    const unitSP = Number(selectedProduct?.UnitSP ?? Number.NaN);
    const hasAll = qty !== null && Number.isFinite(unitSP);
    const nextSales = hasAll ? String(unitSP * qty) : '';
    setForm((prev) => (prev.sales === nextSales ? prev : { ...prev, sales: nextSales }));
  }, [form.quantity, selectedProduct]);

  useEffect(() => {
    const qty = numberOrNull(form.quantity);
    const unitSP = Number(selectedProduct?.UnitSP ?? Number.NaN);
    const unitCP = Number(selectedProduct?.UnitCP ?? Number.NaN);
    const hasAll = qty !== null && Number.isFinite(unitSP) && Number.isFinite(unitCP);
    const nextProfit = hasAll ? String((unitSP * qty) - (unitCP * qty)) : '';
    setForm((prev) => (prev.profit === nextProfit ? prev : { ...prev, profit: nextProfit }));
  }, [form.quantity, selectedProduct]);

  const derivedCalendar = useMemo(() => {
    const dt = new Date(form.orderDate);
    if (Number.isNaN(dt.getTime())) return null;
    const dayOfWeek = dt.toLocaleDateString('en-US', { weekday: 'long' });
    const dayOfMonth = dt.getDate();
    const month = dt.getMonth() + 1;
    const isWeekend: 0 | 1 = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday' ? 1 : 0;
    return { month, dayOfWeek, dayOfMonth, isWeekend };
  }, [form.orderDate]);

  function buildPayload(): ForecastShipmentInput {
    const sales = numberOrNull(form.sales);
    const quantity = numberOrNull(form.quantity);
    const profit = numberOrNull(form.profit);
    const longitude = selectedLocation ? toCoord(selectedLocation, 'longitude') : null;
    const latitude = selectedLocation ? toCoord(selectedLocation, 'latitude') : null;
    if (
      !selectedShipMode
      || !selectedSalesPerson
      || !selectedCustomer
      || !selectedProduct
      || !selectedLocation
      || sales === null
      || quantity === null
      || profit === null
      || longitude === null
      || latitude === null
    ) {
      throw new Error('Missing required delay-model fields. Please complete all required selections.');
    }

    return {
      orderDate: form.orderDate,
      shipMode: selectedShipMode.ShipMode,
      shipModeID: selectedShipMode.ShipModeID,
      postalCode: String(selectedLocation.PostalCode),
      retailSalesPeopleID: selectedSalesPerson.RetailSalesPeopleID,
      productID: selectedProduct.ProductID,
      sales,
      quantity,
      profit,
      cusSegmentID: selectedCustomer.CusSegmentID,
      segment: selectedCustomer.Segment,
      subCategoryID: selectedProduct.SubCategoryID,
      categoryID: selectedProduct.CategoryID,
      region: selectedLocation.Region,
      longitude,
      latitude,
    };
  }

  const canSubmit = useMemo(() => {
    if (loading || loadingLookup) return false;
    try {
      buildPayload();
      return true;
    } catch {
      return false;
    }
  }, [loading, loadingLookup, form, selectedShipMode, selectedSalesPerson, selectedCustomer, selectedProduct, selectedLocation]);

  async function runPrediction() {
    setLoading(true);
    setError(null);

    try {
      const payload = buildPayload();
      const res = await fetch('/api/forecast/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipments: [payload] }),
      });
      const json = (await res.json()) as ForecastPredictResponse | { error?: string };
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Prediction failed');
      setResult(json as ForecastPredictResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run prediction');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-black text-on-primary-fixed">Forecast</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Delay model input is aligned to training features. You select order-like fields, and calendar predictors
          (<span className="font-mono">month/dayOfWeek/dayOfMonth/isWeekend</span>) are extracted from order date.
        </p>
      </div>

      <div className="rounded-2xl border border-outline-variant/50 bg-surface-container p-5 space-y-4">
        <h2 className="text-base font-semibold text-on-surface">Shipment — delay-risk model</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Order date</span>
            <input
              type="date"
              value={form.orderDate}
              onChange={(e) => setForm((p) => ({ ...p, orderDate: e.target.value }))}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Ship mode</span>
            <select
              value={selectedShipModeId ?? ''}
              onChange={(e) => setSelectedShipModeId(Number(e.target.value) || null)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            >
              <option value="">Select ship mode</option>
              {shipModes.map((mode) => (
                <option key={mode.ShipModeID} value={mode.ShipModeID}>
                  {mode.ShipMode}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Sales person</span>
            <select
              value={selectedSalesPeopleId ?? ''}
              onChange={(e) => setSelectedSalesPeopleId(Number(e.target.value) || null)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            >
              <option value="">Select sales person</option>
              {salesPeople.map((person) => (
                <option key={person.RetailSalesPeopleID} value={person.RetailSalesPeopleID}>
                  {person.RetailSalesPeople}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Customer (segment source)</span>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.CustomerID} value={c.CustomerID}>
                  {c.CustomerName} ({c.Segment})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Product</span>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.ProductID} value={p.ProductID}>
                  {p.ProductName}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <span className="text-xs text-on-surface-variant">Postal/location</span>
            <input
              type="text"
              value={postalSearch}
              onChange={(e) => {
                setPostalSearch(e.target.value);
                setSelectedLocation(null);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              placeholder="Type postal code or city"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
            {searchingLocation && <p className="text-xs text-on-surface-variant">Searching locations...</p>}
            {showLocationSuggestions && !searchingLocation && locations.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-outline-variant/60 bg-surface">
                {locations.map((loc) => (
                  <button
                    key={`${loc.PostalCode}-${loc.City}-${loc.State}`}
                    type="button"
                    onClick={() => {
                      setSelectedLocation(loc);
                      setPostalSearch(String(loc.PostalCode));
                      setLocations([]);
                      setShowLocationSuggestions(false);
                    }}
                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-surface-container-high ${
                      selectedLocation?.PostalCode === loc.PostalCode ? 'bg-surface-container-high' : ''
                    }`}
                  >
                    {loc.PostalCode} · {loc.City}, {loc.State} · {loc.Region}
                  </button>
                ))}
              </div>
            )}
            {selectedLocation && (
              <p className="text-xs text-on-surface-variant">
                Selected: {selectedLocation.PostalCode} · {selectedLocation.City}, {selectedLocation.State}
              </p>
            )}
          </div>

          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Expected revenue</span>
            <input
              type="number"
              value={form.sales}
              readOnly
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant cursor-not-allowed"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Quantity</span>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">Profit</span>
            <input
              type="number"
              value={form.profit}
              readOnly
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant cursor-not-allowed"
            />
          </label>
        </div>

        <DerivedCalendarCard derivedCalendar={derivedCalendar} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runPrediction}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-full px-5 h-10 text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">warning</span>
            {loading ? 'Scoring…' : 'Run delay-risk forecast'}
          </button>
          {loadingLookup && <p className="text-xs text-on-surface-variant">Loading lookup data...</p>}
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      </div>

      {result?.predictions[0] && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Delay risk score" value={result.predictions[0].delayRiskScore.toFixed(2)} icon="warning" />
            <StatCard title="Delay risk label" value={result.predictions[0].delayRiskLabel} icon="crisis_alert" />
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Summary</h3>
            <p className="mt-2 text-sm text-on-surface leading-relaxed">{result.predictions[0].explanation}</p>
            <p className="mt-3 text-xs text-on-surface-variant">
              Model <span className="font-mono text-on-surface">{result.modelVersion}</span>
              {' · '}
              <span className="font-mono">{result.generatedAt}</span>
            </p>
          </div>
          <p className="text-xs text-on-surface-variant">
            Labels use training cuts: Low &lt; 0.3 · Medium ≥ 0.3 and &lt; 0.6 · High ≥ 0.6.
          </p>
        </div>
      )}
    </section>
  );
}

function DerivedCalendarCard({
  derivedCalendar,
}: Readonly<{ derivedCalendar: { month: number; dayOfWeek: string; dayOfMonth: number; isWeekend: 0 | 1 } | null }>) {
  if (!derivedCalendar) return null;

  const items = [
    { label: 'month', value: String(derivedCalendar.month) },
    { label: 'dayOfWeek', value: derivedCalendar.dayOfWeek },
    { label: 'dayOfMonth', value: String(derivedCalendar.dayOfMonth) },
    { label: 'isWeekend', value: String(derivedCalendar.isWeekend) },
  ];

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
        Derived from order date
      </span>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-outline-variant/40 bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{item.label}</p>
            <p className="text-sm font-medium text-on-surface">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: Readonly<{ title: string; value: string; icon: string }>) {
  return (
    <article className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">{title}</h3>
        <span className="material-symbols-outlined text-on-surface-variant text-base">{icon}</span>
      </div>
      <p className="mt-3 text-xl font-semibold text-on-surface">{value}</p>
    </article>
  );
}
