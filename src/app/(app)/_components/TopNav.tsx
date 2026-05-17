'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const navigationSearchItems = [
  { href: '/dashboard', label: 'Sales Insights' },
  { href: '/analytics', label: 'Operations Insights' },
  { href: '/products', label: 'Products' },
  { href: '/shipments', label: 'Shipments' },
  { href: '/orders', label: 'Orders' },
  { href: '/orders/search', label: 'Search Order' },
  { href: '/dev', label: 'Dev' },
  { href: '/help', label: 'Help Center' },
  { href: '/settings', label: 'Settings' },
];

type FilterOptionsResponse = {
  regions?: string[];
  states?: string[];
  years?: number[];
};

const MONTHS = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

export function TopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const isInsightsPage = pathname === '/dashboard' || pathname === '/analytics';
  const sharedFilterKeys = ['region', 'state', 'year', 'month'];

  const matchedNavigationItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return navigationSearchItems
      .filter((item) => item.label.toLowerCase().includes(term) || item.href.toLowerCase().includes(term))
      .slice(0, 6);
  }, [search]);

  useEffect(() => {
    if (!isInsightsPage) return;
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch('/api/analytics/filters', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as FilterOptionsResponse;
        if (!alive) return;
        setRegions(payload.regions ?? []);
        setStates(payload.states ?? []);
        const availableYears = (payload.years ?? []).map(String);
        setYears(availableYears.toSorted((a, b) => Number(a) - Number(b)));
      } catch {
        if (!alive) return;
        setRegions([]);
        setStates([]);
        setYears([]);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [isInsightsPage]);

  const withSharedFilters = (href: string): string => {
    if (href !== '/dashboard' && href !== '/analytics') return href;
    const sp = new URLSearchParams();
    for (const key of sharedFilterKeys) {
      for (const value of searchParams.getAll(key)) {
        if (value) sp.append(key, value);
      }
    }
    const query = sp.toString();
    return query ? `${href}?${query}` : href;
  };
  const searchParamString = searchParams.toString();

  return (
    <header className="text-[#0D1B2A] dark:text-[#f7f9fb] bg-[#f2f4f6] dark:bg-[#191c1e] w-full px-8 py-4 sticky top-0 z-50">
      <div className="relative w-full max-w-md">
        <div className="bg-surface-container-high rounded-full px-4 py-2 items-center space-x-2 focus-within:bg-surface-container-lowest focus-within:shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] transition-colors flex">
          <span className="material-symbols-outlined text-on-surface-variant">search</span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full placeholder-on-surface-variant font-body font-normal outline-none"
            placeholder="Search navigation..."
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matchedNavigationItems[0]) {
                event.preventDefault();
                router.push(withSharedFilters(matchedNavigationItems[0].href));
                setSearch('');
              }
            }}
          />
        </div>
        {search.trim() && (
          <div className="absolute top-full left-0 mt-2 w-full rounded-xl bg-surface-container-lowest shadow-[0_8px_24px_rgba(0,0,0,0.16)] border border-surface-container-high overflow-hidden">
            {matchedNavigationItems.length > 0 ? (
              matchedNavigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={withSharedFilters(item.href)}
                  className="flex items-center justify-between px-3 py-2 text-xs text-on-surface hover:bg-surface-container-high transition-colors font-body font-medium"
                  onClick={() => setSearch('')}
                >
                  <span>{item.label}</span>
                  <span className="text-on-surface-variant">{item.href}</span>
                </Link>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-on-surface-variant font-body font-medium">
                No matching navigation items
              </div>
            )}
          </div>
        )}
      </div>
      {isInsightsPage ? (
        <SharedFiltersBar
          key={`${pathname}?${searchParamString}`}
          pathname={pathname}
          searchParamString={searchParamString}
          regions={regions}
          states={states}
          years={years}
        />
      ) : null}
    </header>
  );
}

function SharedFiltersBar({
  pathname,
  searchParamString,
  regions,
  states,
  years,
}: Readonly<{
  pathname: string;
  searchParamString: string;
  regions: string[];
  states: string[];
  years: string[];
}>) {
  const router = useRouter();
  const initialParams = new URLSearchParams(searchParamString);
  const [region, setRegion] = useState(initialParams.get('region') ?? '');
  const [state, setState] = useState(initialParams.get('state') ?? '');
  const [selectedMonths, setSelectedMonths] = useState(initialParams.getAll('month').filter(Boolean));
  const [selectedYears, setSelectedYears] = useState(initialParams.getAll('year').filter(Boolean));
  const [warning, setWarning] = useState('');
  const [openPanel, setOpenPanel] = useState<'month' | 'year' | null>(null);
  const sharedFilterKeys = ['region', 'state', 'year', 'month'];
  const monthPanelRef = useRef<HTMLDivElement | null>(null);
  const yearPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const isInsideMonth = monthPanelRef.current?.contains(target) ?? false;
      const isInsideYear = yearPanelRef.current?.contains(target) ?? false;
      if (!isInsideMonth && !isInsideYear) {
        setOpenPanel(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void): void => {
    if (values.includes(value)) {
      setValues(values.filter((item) => item !== value));
      return;
    }
    setValues([...values, value]);
  };

  const applySharedFilters = () => {
    if (selectedMonths.length > 0 && selectedYears.length === 0) {
      setWarning('Please select at least one year before applying month filters.');
      return;
    }
    const next = new URLSearchParams(searchParamString);
    for (const key of sharedFilterKeys) {
      next.delete(key);
    }
    if (region) next.set('region', region);
    if (state) next.set('state', state);
    for (const year of selectedYears) {
      if (year) next.append('year', year);
    }
    for (const month of selectedMonths) {
      if (month) next.append('month', month);
    }
    setWarning('');
    setOpenPanel(null);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const resetSharedFilters = () => {
    const next = new URLSearchParams(searchParamString);
    for (const key of sharedFilterKeys) {
      next.delete(key);
    }
    const latestYear = years.at(-1);
    if (latestYear) {
      next.append('year', latestYear);
      for (const month of MONTHS) {
        next.append('month', month.value);
      }
    }
    setRegion('');
    setState('');
    setSelectedMonths(latestYear ? MONTHS.map((month) => month.value) : []);
    setSelectedYears(latestYear ? [latestYear] : []);
    setWarning('');
    setOpenPanel(null);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.12)]">
      <label className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 h-8 text-xs text-on-surface-variant">
        <span className="text-[11px]">Region:</span>
        <select
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          className="bg-transparent outline-none text-xs text-on-surface"
        >
          <option value="">All</option>
          {regions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 h-8 text-xs text-on-surface-variant">
        <span className="text-[11px]">State:</span>
        <select
          value={state}
          onChange={(event) => setState(event.target.value)}
          className="bg-transparent outline-none text-xs text-on-surface"
        >
          <option value="">All</option>
          {states.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="relative" ref={monthPanelRef}>
        <button
          type="button"
          onClick={() => setOpenPanel((prev) => (prev === 'month' ? null : 'month'))}
          className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-3 h-8 text-xs text-on-surface-variant"
        >
          Month ({selectedMonths.length})
        </button>
        {openPanel === 'month' ? (
          <div className="absolute left-0 mt-2 z-50 w-72 rounded-lg bg-surface-container-lowest p-3 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
            <div className="mb-2 flex items-center justify-between text-[11px] text-on-surface-variant">
              <button
                type="button"
                className="hover:text-on-surface"
                onClick={() => setSelectedMonths(MONTHS.map((month) => month.value))}
              >
                Select all
              </button>
              <button
                type="button"
                className="hover:text-on-surface"
                onClick={() => setSelectedMonths([])}
              >
                Deselect all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {MONTHS.map((month) => (
                <label key={month.value} className="inline-flex items-center gap-1 text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={selectedMonths.includes(month.value)}
                    onChange={() => toggleValue(month.value, selectedMonths, setSelectedMonths)}
                    className="accent-primary"
                  />
                  {month.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative" ref={yearPanelRef}>
        <button
          type="button"
          onClick={() => setOpenPanel((prev) => (prev === 'year' ? null : 'year'))}
          className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-3 h-8 text-xs text-on-surface-variant"
        >
          Year ({selectedYears.length})
        </button>
        {openPanel === 'year' ? (
          <div className="absolute left-0 mt-2 z-50 w-64 rounded-lg bg-surface-container-lowest p-3 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
            <div className="mb-2 flex items-center justify-between text-[11px] text-on-surface-variant">
              <button
                type="button"
                className="hover:text-on-surface"
                onClick={() => setSelectedYears(years)}
              >
                Select all
              </button>
              <button
                type="button"
                className="hover:text-on-surface"
                onClick={() => setSelectedYears([])}
              >
                Deselect all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {years.map((yearOption) => (
                <label key={yearOption} className="inline-flex items-center gap-1 text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={selectedYears.includes(yearOption)}
                    onChange={() => toggleValue(yearOption, selectedYears, setSelectedYears)}
                    className="accent-primary"
                  />
                  {yearOption}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={applySharedFilters}
        className="inline-flex items-center gap-1 rounded-full px-4 h-8 text-xs font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors ml-auto"
      >
        Apply Filters
      </button>
      <button
        type="button"
        onClick={resetSharedFilters}
        className="inline-flex items-center gap-1 rounded-full px-3 h-8 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
      >
        Reset
      </button>
      {warning ? <p className="w-full text-xs text-[#c62828]">{warning}</p> : null}
    </div>
  );
}
