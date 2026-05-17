'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bouncy, useMotionPreference } from '../../_components/motion-presets';

interface ShipMode {
  ShipModeID: number;
  ShipMode: string;
}

interface SalesPerson {
  RetailSalesPeopleID: number;
  RetailSalesPeople: string;
}

interface Customer {
  CustomerID: string;
  CustomerName: string;
  Segment: string;
}

interface Product {
  ProductID: string;
  ProductName: string;
  Category: string;
  SubCategory: string;
}

interface Location {
  PostalCode: string | number;
  City: string;
  State: string;
  Region: string;
  Country: string;
}

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

/** Returns items ranked: exact start-of-word match first, then any substring match. */
function rankMatches<T>(items: T[], query: string, keys: (item: T) => string[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const fields = keys(item).map((s) => s.toLowerCase());
    if (fields.some((f) => f.startsWith(q))) {
      starts.push(item);
    } else if (fields.some((f) => f.includes(q))) {
      contains.push(item);
    }
  }
  return [...starts, ...contains];
}

const FIELD_CLASS =
  'w-full bg-surface-container-low border border-[rgba(196,198,204,0.2)] rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors';

const LABEL_CLASS = 'block text-xs font-label font-semibold text-on-surface-variant mb-1';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={LABEL_CLASS}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

/** Compact chip shown after a customer/product is selected */
function SelectedChip({
  icon,
  primary,
  secondary,
  onClear,
  clearLabel,
}: {
  icon: string;
  primary: string;
  secondary: string;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-primary-container/30 border border-primary/20 px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-base text-primary shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{primary}</p>
          <p className="text-xs text-on-surface-variant truncate">{secondary}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-primary hover:underline shrink-0 mt-0.5"
      >
        {clearLabel}
      </button>
    </div>
  );
}

/** Scrollable suggestion list for customer/product pickers */
function SuggestionList<T>({
  items,
  renderItem,
  onSelect,
  emptyMsg,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  emptyMsg: string;
}) {
  return (
    <div className="rounded-lg border border-[rgba(196,198,204,0.2)] bg-surface-container-low overflow-hidden max-h-48 overflow-y-auto">
      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs text-on-surface-variant">{emptyMsg}</p>
      ) : (
        items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(item)}
            className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors border-b border-[rgba(196,198,204,0.1)] last:border-0"
          >
            {renderItem(item)}
          </button>
        ))
      )}
    </div>
  );
}

export function ManualOrderForm() {
  const { reducedMotion } = useMotionPreference();

  // Lookup data
  const [shipModes, setShipModes] = useState<ShipMode[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingLookup, setLoadingLookup] = useState(true);

  // Picker state
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Postal code autocomplete
  const [postalInput, setPostalInput] = useState('');
  const [postalSuggestions, setPostalSuggestions] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [postalLoading, setPostalLoading] = useState(false);
  const postalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    OrderID: '',
    OrderDate: '',
    ShipDate: '',
    ShipModeID: '',
    CustomerID: '',
    PostalCode: '',
    RetailSalesPeopleID: '',
    ProductID: '',
    Returned: '',
    ShipStatus: '',
    Sales: '',
    Quantity: '',
    Profit: '',
    Cost: '',
    Days: '',
  });

  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [resultMsg, setResultMsg] = useState('');

  // Auto-calculate Profit whenever Sales or Cost changes
  useEffect(() => {
    const sales = parseFloat(form.Sales);
    const cost = parseFloat(form.Cost);
    if (!isNaN(sales) && !isNaN(cost)) {
      setForm((prev) => ({ ...prev, Profit: (sales - cost).toFixed(2) }));
    } else {
      setForm((prev) => ({ ...prev, Profit: '' }));
    }
  }, [form.Sales, form.Cost]);

  // Auto-calculate Days whenever OrderDate or ShipDate changes
  useEffect(() => {
    if (form.OrderDate && form.ShipDate) {
      const order = new Date(form.OrderDate).getTime();
      const ship = new Date(form.ShipDate).getTime();
      const diff = Math.max(0, Math.round((ship - order) / 86_400_000));
      setForm((prev) => ({ ...prev, Days: String(diff) }));
    } else {
      setForm((prev) => ({ ...prev, Days: '' }));
    }
  }, [form.OrderDate, form.ShipDate]);

  useEffect(() => {
    async function loadLookup() {
      try {
        const [lookupRes, custRes, prodRes] = await Promise.all([
          fetch('/api/orders/lookup'),
          fetch('/api/customers?limit=500'),
          fetch('/api/products?limit=500'),
        ]);
        const lookup = await lookupRes.json();
        const custData = await custRes.json();
        const prodData = await prodRes.json();
        setShipModes(lookup.shipModes ?? []);
        setSalesPeople(lookup.salesPeople ?? []);
        setCustomers(custData.data ?? []);
        setProducts(prodData.data ?? []);
      } catch {
        // non-fatal
      } finally {
        setLoadingLookup(false);
      }
    }
    loadLookup();
  }, []);

  // Debounced postal code search
  function handlePostalInput(value: string) {
    setPostalInput(value);
    setSelectedLocation(null);
    setForm((prev) => ({ ...prev, PostalCode: value }));
    if (postalTimer.current) clearTimeout(postalTimer.current);
    if (!value.trim()) {
      setPostalSuggestions([]);
      return;
    }
    postalTimer.current = setTimeout(async () => {
      setPostalLoading(true);
      try {
        const res = await fetch(`/api/locations?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setPostalSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setPostalSuggestions([]);
      } finally {
        setPostalLoading(false);
      }
    }, 300);
  }

  function selectLocation(loc: Location) {
    const code = String(loc.PostalCode);
    setPostalInput(code);
    setSelectedLocation(loc);
    setPostalSuggestions([]);
    setForm((prev) => ({ ...prev, PostalCode: code }));
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setForm((prev) => ({ ...prev, CustomerID: c.CustomerID }));
    setCustomerSearch('');
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setForm((prev) => ({ ...prev, CustomerID: '' }));
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setForm((prev) => ({ ...prev, ProductID: p.ProductID }));
    setProductSearch('');
  }

  function clearProduct() {
    setSelectedProduct(null);
    setForm((prev) => ({ ...prev, ProductID: '' }));
  }

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const filteredCustomers = rankMatches(
    customers,
    customerSearch,
    (c) => [c.CustomerName, c.CustomerID],
  );

  const filteredProducts = rankMatches(
    products,
    productSearch,
    (p) => [p.ProductName, p.ProductID],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;

    setStatus('loading');
    setResultMsg('');

    const payload = {
      OrderID: form.OrderID,
      OrderDate: form.OrderDate,
      ShipDate: form.ShipDate || null,
      ShipModeID: form.ShipModeID ? Number(form.ShipModeID) : null,
      CustomerID: form.CustomerID,
      PostalCode: form.PostalCode || null,
      RetailSalesPeopleID: form.RetailSalesPeopleID ? Number(form.RetailSalesPeopleID) : null,
      ProductID: form.ProductID,
      Returned: form.Returned || null,
      ShipStatus: form.ShipStatus || null,
      Sales: form.Sales ? Number(form.Sales) : null,
      Quantity: form.Quantity ? Number(form.Quantity) : null,
      Profit: form.Profit ? Number(form.Profit) : null,
      Cost: form.Cost ? Number(form.Cost) : null,
      Days: form.Days ? Number(form.Days) : null,
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setResultMsg(`Order inserted — RetailOrderID: ${data.RetailOrderID}`);
        setForm({
          OrderID: '', OrderDate: '', ShipDate: '', ShipModeID: '', CustomerID: '',
          PostalCode: '', RetailSalesPeopleID: '', ProductID: '', Returned: '',
          ShipStatus: '', Sales: '', Quantity: '', Profit: '', Cost: '', Days: '',
        });
        setSelectedCustomer(null);
        setSelectedProduct(null);
        setSelectedLocation(null);
        setPostalInput('');
        setCustomerSearch('');
        setProductSearch('');
      } else {
        setStatus('error');
        setResultMsg(data.error ?? 'Submission failed');
      }
    } catch (err) {
      setStatus('error');
      setResultMsg(err instanceof Error ? err.message : 'Network error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {loadingLookup && (
        <p className="text-xs text-on-surface-variant animate-pulse">Loading lookup data…</p>
      )}

      {/* Order Details */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] overflow-hidden">
        <div className="p-4 border-b border-[rgba(196,198,204,0.12)] flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-on-surface-variant">receipt_long</span>
          <span className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider">Order Details</span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Order ID" required>
            <input
              type="text"
              required
              value={form.OrderID}
              onChange={(e) => set('OrderID', e.target.value)}
              placeholder="CA-2026-999"
              className={FIELD_CLASS}
            />
          </Field>
          <Field label="Order Date" required>
            <input
              type="date"
              required
              value={form.OrderDate}
              onChange={(e) => set('OrderDate', e.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
          <Field label="Ship Date">
            <input
              type="date"
              value={form.ShipDate}
              onChange={(e) => set('ShipDate', e.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
          <Field label="Ship Mode">
            <select
              value={form.ShipModeID}
              onChange={(e) => set('ShipModeID', e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">— Select —</option>
              {shipModes.map((sm) => (
                <option key={sm.ShipModeID} value={sm.ShipModeID}>{sm.ShipMode}</option>
              ))}
            </select>
          </Field>
          <Field label="Ship Status">
            <select
              value={form.ShipStatus}
              onChange={(e) => set('ShipStatus', e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">— Select —</option>
              <option value="On-Time">On-Time</option>
              <option value="Late">Late</option>
            </select>
          </Field>
          <Field label="Returned">
            <select
              value={form.Returned}
              onChange={(e) => set('Returned', e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">— Select —</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Customer & Product */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] overflow-hidden">
        <div className="p-4 border-b border-[rgba(196,198,204,0.12)] flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-on-surface-variant">person</span>
          <span className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider">Customer &amp; Product</span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Customer picker */}
          <Field label="Customer" required>
            {/* Hidden required input to trigger native validation */}
            <input type="text" required value={form.CustomerID} readOnly className="sr-only" aria-hidden />
            <AnimatePresence mode="wait">
              {selectedCustomer ? (
                <motion.div
                  key="selected"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={reducedMotion ? { duration: 0.1 } : bouncy}
                >
                  <SelectedChip
                    icon="person"
                    primary={selectedCustomer.CustomerName}
                    secondary={`${selectedCustomer.CustomerID} · ${selectedCustomer.Segment}`}
                    onClear={clearCustomer}
                    clearLabel="Change customer"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="picker"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={reducedMotion ? { duration: 0.1 } : bouncy}
                  className="space-y-1.5"
                >
                  <input
                    type="text"
                    placeholder="Search by name or ID…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={FIELD_CLASS}
                  />
                  {customerSearch.trim() ? (
                    <SuggestionList
                      items={filteredCustomers.slice(0, 60)}
                      emptyMsg={loadingLookup ? 'Loading…' : 'No customers match your search'}
                      onSelect={selectCustomer}
                      renderItem={(c) => (
                        <span className="flex items-baseline gap-2">
                          <span className="font-medium">{c.CustomerName}</span>
                          <span className="text-xs text-on-surface-variant">{c.CustomerID}</span>
                          <span className="ml-auto text-xs text-on-surface-variant">{c.Segment}</span>
                        </span>
                      )}
                    />
                  ) : (
                    <p className="text-xs text-on-surface-variant px-1 pt-1">
                      Type to search customers
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Field>

          {/* Product picker */}
          <Field label="Product" required>
            <input type="text" required value={form.ProductID} readOnly className="sr-only" aria-hidden />
            <AnimatePresence mode="wait">
              {selectedProduct ? (
                <motion.div
                  key="selected"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={reducedMotion ? { duration: 0.1 } : bouncy}
                >
                  <SelectedChip
                    icon="inventory_2"
                    primary={selectedProduct.ProductName}
                    secondary={`${selectedProduct.SubCategory} · ${selectedProduct.Category}`}
                    onClear={clearProduct}
                    clearLabel="Change product"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="picker"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={reducedMotion ? { duration: 0.1 } : bouncy}
                  className="space-y-1.5"
                >
                  <input
                    type="text"
                    placeholder="Search by name or ID…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className={FIELD_CLASS}
                  />
                  {productSearch.trim() ? (
                    <SuggestionList
                      items={filteredProducts.slice(0, 60)}
                      emptyMsg={loadingLookup ? 'Loading…' : 'No products match your search'}
                      onSelect={selectProduct}
                      renderItem={(p) => (
                        <span className="flex items-baseline gap-2">
                          <span className="font-medium truncate">{p.ProductName}</span>
                          <span className="ml-auto text-xs text-on-surface-variant shrink-0">{p.SubCategory}</span>
                        </span>
                      )}
                    />
                  ) : (
                    <p className="text-xs text-on-surface-variant px-1 pt-1">
                      Type to search products
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Field>

          {/* Postal code with autocomplete */}
          <Field label="Postal Code">
            <div className="relative">
              <input
                type="text"
                value={postalInput}
                onChange={(e) => handlePostalInput(e.target.value)}
                onFocus={() => {
                  if (postalInput && !selectedLocation) handlePostalInput(postalInput);
                }}
                placeholder="Start typing a postal code or city…"
                className={FIELD_CLASS}
                autoComplete="off"
              />
              {postalLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-on-surface-variant animate-spin">
                  progress_activity
                </span>
              )}
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {postalSuggestions.length > 0 && !selectedLocation && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={reducedMotion ? { duration: 0.1 } : bouncy}
                  className="mt-1 rounded-lg border border-[rgba(196,198,204,0.2)] bg-surface-container-low shadow-lg overflow-hidden z-10"
                >
                  {postalSuggestions.map((loc) => (
                    <button
                      key={String(loc.PostalCode)}
                      type="button"
                      onClick={() => selectLocation(loc)}
                      className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors border-b border-[rgba(196,198,204,0.1)] last:border-0"
                    >
                      <span className="font-medium font-mono">{loc.PostalCode}</span>
                      <span className="text-on-surface-variant ml-2">
                        {loc.City}, {loc.State}
                      </span>
                      <span className="text-xs text-on-surface-variant ml-2">· {loc.Region}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirmed location info */}
            <AnimatePresence>
              {selectedLocation && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reducedMotion ? { duration: 0.1 } : bouncy}
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                  <span>
                    <span className="font-semibold text-on-surface">{selectedLocation.City}</span>
                    {', '}
                    {selectedLocation.State}
                    {' · '}
                    {selectedLocation.Region}
                    {', '}
                    {selectedLocation.Country}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocation(null);
                      setPostalSuggestions([]);
                    }}
                    className="ml-1 text-primary hover:underline"
                  >
                    Change
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </Field>

          <Field label="Sales Person">
            <select
              value={form.RetailSalesPeopleID}
              onChange={(e) => set('RetailSalesPeopleID', e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">— Select —</option>
              {salesPeople.map((sp) => (
                <option key={sp.RetailSalesPeopleID} value={sp.RetailSalesPeopleID}>
                  {sp.RetailSalesPeople}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Financials */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] overflow-hidden">
        <div className="p-4 border-b border-[rgba(196,198,204,0.12)] flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-on-surface-variant">attach_money</span>
          <span className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider">Financials</span>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(['Sales', 'Cost', 'Quantity'] as const).map((f) => (
            <Field key={f} label={f}>
              <input
                type="number"
                step={f === 'Quantity' ? '1' : '0.01'}
                min="0"
                value={form[f]}
                onChange={(e) => set(f, e.target.value)}
                className={FIELD_CLASS}
              />
            </Field>
          ))}
          <Field label="Profit (auto)">
            <input
              type="number"
              readOnly
              value={form.Profit}
              placeholder="—"
              className={`${FIELD_CLASS} cursor-default opacity-70`}
              tabIndex={-1}
            />
            {(!form.Sales || !form.Cost) ? (
              <p className="mt-1 text-[10px] text-on-surface-variant">Set Sales &amp; Cost above</p>
            ) : null}
          </Field>
          <Field label="Days (auto)">
            <input
              type="number"
              readOnly
              value={form.Days}
              placeholder="—"
              className={`${FIELD_CLASS} cursor-default opacity-70`}
              tabIndex={-1}
            />
            {!form.OrderDate || !form.ShipDate ? (
              <p className="mt-1 text-[10px] text-on-surface-variant">Set both dates above</p>
            ) : null}
          </Field>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center gap-2 rounded-full px-6 h-10 text-sm font-body font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              Submitting…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">add_circle</span>
              Add Order
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {resultMsg && (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={reducedMotion ? { duration: 0.15 } : bouncy}
            className={`rounded-xl p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] flex gap-3 ${
              status === 'success' ? 'bg-[rgba(0,128,64,0.08)]' : 'bg-[rgba(180,0,0,0.07)]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-xl mt-0.5 shrink-0 ${
                status === 'success' ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {status === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className="text-sm text-on-surface">{resultMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
