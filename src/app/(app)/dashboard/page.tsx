import {
  getFilters,
  getDeliveryByCategory,
  getRegionPerformance,
  getShipMode,
  getSummary,
  getTimeseries,
  type AnalyticsFilters,
  type ShipModePoint,
  type TimeseriesPoint,
} from './analytics-api';
import { KpiGrid } from './KpiGrid';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function readMultiParam(sp: SearchParams, key: string): string[] {
  const value = sp[key];
  if (Array.isArray(value)) return value.filter((entry) => entry !== '');
  if (typeof value === 'string' && value !== '') return [value];
  return [];
}

function toFilters(sp: SearchParams): AnalyticsFilters {
  return {
    region: readParam(sp, 'region'),
    state: readParam(sp, 'state'),
    segment: readParam(sp, 'segment'),
    category: readParam(sp, 'category'),
    subCategory: readParam(sp, 'subCategory'),
    shipMode: readParam(sp, 'shipMode'),
    years: readMultiParam(sp, 'year'),
    months: readMultiParam(sp, 'month'),
    startDate: readParam(sp, 'startDate'),
    endDate: readParam(sp, 'endDate'),
  };
}

function buildSharedResetQuery(): string {
  return '';
}

const compactMoney = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};

const compactNumber = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return `${v.toFixed(0)}`;
};

const percent = (v: number): string => `${v.toFixed(1)}%`;

const REGION_COLOR_MAP: Record<string, string> = {
  west: '#FFCCBB',
  east: '#6EB5C0',
  central: '#006C84',
  south: '#C67D58',
};

const REGION_FALLBACK_PALETTE = [
  '#FFCCBB',
  '#6EB5C0',
  '#006C84',
  '#E2E8E4',
];

const CATEGORY_PALETTE = ['#FFCCBB', '#6EB5C0', '#006C84', '#C67D58', '#E2E8E4'];
const CATEGORY_COLOR_MAP: Record<string, string> = {
  technology: '#006C84',
  'office supplies': '#6EB5C0',
};

function buildTrendPoints(series: TimeseriesPoint[], key: 'sales' | 'orders'): string {
  if (series.length === 0) return '';
  const values = series.map((p) => p[key]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  return series
    .map((p, i) => {
      const x = i * step;
      const y = 100 - ((p[key] - min) / range) * 80 - 10;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function getSeriesStats(series: TimeseriesPoint[], key: 'sales' | 'orders'): {
  min: number;
  max: number;
  latest: number;
  average: number;
} {
  if (series.length === 0) {
    return { min: 0, max: 0, latest: 0, average: 0 };
  }
  const values = series.map((point) => point[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1] ?? 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { min, max, latest, average };
}

function getRegionColor(region: string): string {
  const normalized = region.trim().toLowerCase();
  const known = REGION_COLOR_MAP[normalized];
  if (known) return known;

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }

  const paletteIndex = Math.abs(hash) % REGION_FALLBACK_PALETTE.length;
  return REGION_FALLBACK_PALETTE[paletteIndex];
}

function getCategoryColor(category: string): string {
  const normalized = category.trim().toLowerCase();
  const known = CATEGORY_COLOR_MAP[normalized];
  if (known) return known;
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = toFilters(sp);

  const results = await Promise.allSettled([
    getFilters(),
    getSummary(filters),
    getTimeseries({ ...filters, granularity: 'month' }),
    getRegionPerformance(filters),
    getDeliveryByCategory(filters),
    getShipMode(filters),
  ]);
  const [filtersResult, summaryResult, timeseriesResult, regionResult, deliveryResult, shipModeResult] = results;

  const filterOptions =
    filtersResult.status === 'fulfilled'
      ? filtersResult.value
      : {
          countries: [],
          regions: [],
          states: [],
          cities: [],
          months: [],
          years: [],
          segments: [],
          categories: [],
          subCategories: [],
          shipModes: [],
          sellers: [],
          dateRange: { earliestDate: null, latestDate: null },
        };
  const summary =
    summaryResult.status === 'fulfilled'
      ? summaryResult.value
      : {
          totalSales: 0,
          totalProfit: 0,
          totalOrders: 0,
          returnRate: 0,
          onTimeDeliveryRate: 0,
        };
  const timeseries = timeseriesResult.status === 'fulfilled' ? timeseriesResult.value : [];
  const regionPerformance = regionResult.status === 'fulfilled' ? regionResult.value : [];
  const deliveryByCategory = deliveryResult.status === 'fulfilled' ? deliveryResult.value : [];
  const shipMode = shipModeResult.status === 'fulfilled' ? shipModeResult.value : [];
  const hasAnalyticsError = results.some((result) => result.status === 'rejected');

  const kpis = [
    { id: 'sales', label: 'Total Sales', value: compactMoney(summary.totalSales) },
    { id: 'profit', label: 'Total Profit', value: compactMoney(summary.totalProfit) },
    { id: 'orders', label: 'Total Orders', value: compactNumber(summary.totalOrders) },
    { id: 'return', label: 'Return Rate', value: percent(summary.returnRate) },
    { id: 'delivery', label: 'On-Time Delivery', value: percent(summary.onTimeDeliveryRate) },
  ];

  const salesPoints = buildTrendPoints(timeseries, 'sales');
  const ordersPoints = buildTrendPoints(timeseries, 'orders');
  const regionMaxSales = Math.max(...regionPerformance.map((item) => item.sales), 0);
  const categoryMaxDays = Math.max(...deliveryByCategory.map((item) => item.avgDays), 0);
  const shipModeLegend = withShipModeColors(shipMode);
  const shipModeTop = shipModeLegend[0];
  const shipModeGradient = buildShipModeGradient(shipModeLegend);
  const salesStats = getSeriesStats(timeseries, 'sales');
  const ordersStats = getSeriesStats(timeseries, 'orders');

  return (
    <>
      {hasAnalyticsError ? (
        <div className="mb-3 rounded-lg bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
          Analytics data is temporarily unavailable. Showing partial results.
        </div>
      ) : null}
      <form
        method="get"
        className="flex flex-wrap items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg shadow-[inset_0_0_0_1px_rgba(196,198,204,0.12)]"
      >
        {filters.region ? <input type="hidden" name="region" value={filters.region} /> : null}
        {filters.state ? <input type="hidden" name="state" value={filters.state} /> : null}
        {(filters.years ?? []).map((year) => (
          <input key={`year-${year}`} type="hidden" name="year" value={year} />
        ))}
        {(filters.months ?? []).map((month) => (
          <input key={`month-${month}`} type="hidden" name="month" value={month} />
        ))}
        <FilterSelect name="segment" label="Segment" options={filterOptions.segments} value={filters.segment} />
        <FilterSelect name="category" label="Category" options={filterOptions.categories} value={filters.category} />
        <FilterSelect name="shipMode" label="Ship Mode" options={filterOptions.shipModes} value={filters.shipMode} />
        <div className="flex items-center gap-1.5 ml-auto">
          <a
            href={`/dashboard${buildSharedResetQuery()}`}
            className="inline-flex items-center gap-1 rounded-full px-3 h-8 text-xs font-body text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            ↺ Reset
          </a>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full px-4 h-8 text-xs font-body font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </form>

      <KpiGrid items={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-headline font-bold text-on-surface">Sales &amp; Late Delivery by Region</h2>
              <span className="text-xs text-primary">Live</span>
            </div>
            <div className="h-64 relative flex items-end justify-between px-4 pb-8">
              <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-on-surface-variant font-label text-right pr-2">
                <span>{compactMoney(regionMaxSales)}</span><span>{compactMoney(regionMaxSales * 0.75)}</span><span>{compactMoney(regionMaxSales * 0.5)}</span><span>{compactMoney(regionMaxSales * 0.25)}</span><span>$0</span>
              </div>
              <div className="absolute right-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-on-surface-variant font-label text-left pl-2">
                <span>10%</span><span>7.5%</span><span>5%</span><span>2.5%</span><span>0</span>
              </div>
              <div className="relative z-10 w-full flex justify-around items-end h-full ml-12 mr-12">
                {regionPerformance.map((item) => (
                  <div
                    key={item.region}
                    className="w-12 rounded-t-sm relative group"
                    style={{
                      height: `${toBarHeight(item.sales, regionMaxSales)}%`,
                      backgroundColor: getRegionColor(item.region),
                    }}
                  >
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-label font-bold text-on-surface-variant">{item.region}</div>
                    <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#101b30] text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                      Sales {compactMoney(item.sales)} · Late {percent(item.lateRate)} · Profit {compactMoney(item.profit)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-headline font-bold text-on-surface">Delivery Performance by Category</h2>
              <span className="text-xs text-primary">Live</span>
            </div>
            <div className="h-64 relative flex items-end justify-between px-4 pb-8">
              <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-on-surface-variant font-label text-right pr-2">
                <span>{categoryMaxDays.toFixed(1)}d</span><span>{(categoryMaxDays * 0.75).toFixed(1)}d</span><span>{(categoryMaxDays * 0.5).toFixed(1)}d</span><span>{(categoryMaxDays * 0.25).toFixed(1)}d</span><span>0</span>
              </div>
              <div className="relative z-10 w-full flex justify-around items-end h-full ml-12">
                {deliveryByCategory.map((item) => (
                  <div
                    key={item.category}
                    className="w-16 rounded-t-sm relative group"
                    style={{
                      height: `${toBarHeight(item.avgDays, categoryMaxDays)}%`,
                      backgroundColor: getCategoryColor(item.category),
                    }}
                  >
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-label text-on-surface-variant whitespace-nowrap">{item.category}</div>
                    <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#101b30] text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                      Avg {item.avgDays.toFixed(1)}d · Late {percent(item.lateRate)} · Orders {compactNumber(item.orders)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
            <h2 className="text-sm font-headline font-bold text-on-surface mb-4">Ship Mode Distribution</h2>
            <div className="flex items-center justify-center h-40">
              <div className="w-32 h-32 rounded-full relative" style={{ background: shipModeGradient }}>
                <div className="absolute inset-3 bg-surface-container-lowest rounded-full flex items-center justify-center">
                  <span className="text-lg font-headline font-bold text-on-surface">{shipModeTop ? percent(shipModeTop.percent) : '0%'}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs font-label">
              {shipModeLegend.map((mode) => (
                <div key={mode.shipMode} className="flex justify-between items-center rounded px-2 py-1 hover:bg-surface-container-low transition-colors" title={`${mode.shipMode}: ${percent(mode.percent)} · ${compactNumber(mode.orders)} orders`}>
                  <div className="flex items-center"><span className={`w-2 h-2 rounded-full ${mode.color} mr-2`} />{mode.shipMode}</div>
                  <span className="font-medium">{percent(mode.percent)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-sm font-headline font-bold text-on-surface">Operational Trends</h2>
              <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-0.5 w-4 bg-[#101b30]" />
                  Sales
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-0.5 w-4 border-t border-dashed border-[#afc9ea]" />
                  Orders
                </span>
              </div>
            </div>
            {timeseries.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-xs text-on-surface-variant">No data for the selected filters.</div>
            ) : (
              <div className="h-32 relative flex items-end" title={`Period: ${timeseries[0]?.bucket ?? '-'} to ${timeseries[timeseries.length - 1]?.bucket ?? '-'}`}>
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[10px] text-on-surface-variant">
                  <span>{compactMoney(salesStats.max)}</span>
                  <span>{compactMoney(salesStats.min)}</span>
                </div>
                <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between text-[10px] text-on-surface-variant text-right">
                  <span>{compactNumber(ordersStats.max)}</span>
                  <span>{compactNumber(ordersStats.min)}</span>
                </div>
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <polyline fill="none" points={salesPoints} stroke="#101b30" strokeWidth="2" />
                  <polyline fill="none" points={ordersPoints} stroke="#afc9ea" strokeDasharray="4" strokeWidth="2" />
                </svg>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
              <div className="rounded bg-surface-container-low px-2 py-1">
                Sales latest <span className="font-semibold text-on-surface">{compactMoney(salesStats.latest)}</span> · Avg {compactMoney(salesStats.average)}
              </div>
              <div className="rounded bg-surface-container-low px-2 py-1 text-right">
                Orders latest <span className="font-semibold text-on-surface">{compactNumber(ordersStats.latest)}</span> · Avg {compactNumber(ordersStats.average)}
              </div>
            </div>
            <div className="flex justify-between mt-4 text-xs font-label text-on-surface-variant">
              <span>{timeseries[0]?.bucket ?? ''}</span>
              <span>{timeseries[timeseries.length - 1]?.bucket ?? ''}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FilterSelect({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: string[];
  value?: string;
}) {
  const active = value !== undefined && value !== '';
  return (
    <div
      className={`relative inline-flex items-center h-8 rounded-full px-3 pr-7 cursor-pointer transition-colors ${
        active
          ? 'bg-primary-container text-on-primary-container shadow-sm'
          : 'bg-surface-container-lowest text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(196,198,204,0.2)] hover:bg-surface-container-high'
      }`}
    >
      <span className="text-[11px] font-label mr-1 pointer-events-none">{label}:</span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className="appearance-none bg-transparent outline-none text-xs font-body cursor-pointer pr-1"
        aria-label={label}
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5l3-3 3 3M3 7l3 3 3-3" /></svg>
    </div>
  );
}

function toBarHeight(value: number, maxValue: number): number {
  if (maxValue <= 0) return 20;
  return 20 + (value / maxValue) * 70;
}

function withShipModeColors(shipModes: ShipModePoint[]): Array<ShipModePoint & { color: string }> {
  const colors = ['bg-primary', 'bg-secondary-fixed-dim', 'bg-surface-variant', 'bg-tertiary', 'bg-primary-container'];
  return shipModes.map((mode, index) => ({ ...mode, color: colors[index % colors.length] }));
}

function buildShipModeGradient(shipModes: Array<ShipModePoint & { color: string }>): string {
  if (shipModes.length === 0) return 'conic-gradient(#e0e3e5 0% 100%)';
  const colorMap: Record<string, string> = {
    'bg-primary': '#101b30',
    'bg-secondary-fixed-dim': '#afc9ea',
    'bg-surface-variant': '#e0e3e5',
    'bg-tertiary': '#6f7f9a',
    'bg-primary-container': '#cbdcf5',
  };
  let cursor = 0;
  const segments = shipModes.map((mode) => {
    const start = cursor;
    cursor += mode.percent;
    const hex = colorMap[mode.color] ?? '#e0e3e5';
    return `${hex} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return `conic-gradient(${segments.join(', ')})`;
}
