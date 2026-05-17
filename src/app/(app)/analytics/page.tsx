import {
  getFilters,
  getKpiMetrics,
  getLateByShipMode,
  getReturnRateTop,
  getSegmentReturnRate,
  getSegmentSalesProfit,
  getSummary,
  getTopCategoriesProfit,
  type AnalyticsFilters,
} from '../dashboard/analytics-api';
import { KpiGrid } from '../dashboard/KpiGrid';

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

function toKpiFilters(sp: SearchParams): AnalyticsFilters {
  return {
    city: readParam(sp, 'city'),
    region: readParam(sp, 'region'),
    state: readParam(sp, 'state'),
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

function daysOrDash(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)} d`;
}

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = toKpiFilters(sp);
  const topRankByRaw = readParam(sp, 'topRankBy');
  const topRankBy: 'product' | 'category' =
    topRankByRaw === 'category' ? 'category' : 'product';

  const results = await Promise.allSettled([
    getFilters(),
    getSummary(filters),
    getKpiMetrics(filters),
    getTopCategoriesProfit(filters),
    getSegmentSalesProfit(filters),
    getSegmentReturnRate(filters),
    getLateByShipMode(filters),
    getReturnRateTop(filters, topRankBy),
  ]);
  const [
    filtersResult,
    summaryResult,
    kpiResult,
    topCategoryProfitResult,
    segmentSalesProfitResult,
    segmentReturnRateResult,
    lateByShipModeResult,
    returnRateTopResult,
  ] = results;

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

  const kpi =
    kpiResult.status === 'fulfilled'
      ? kpiResult.value
      : {
          onTimeDeliveryRate: null as number | null,
          lateDeliveryRate: null as number | null,
          returnRate: 0,
          avgShipDays: null as number | null,
          linesWithDeliveryStatus: 0,
          totalLines: 0,
        };

  const hasError = results.some((r) => r.status === 'rejected');
  const topCategoryProfit =
    topCategoryProfitResult.status === 'fulfilled' ? topCategoryProfitResult.value : [];
  const segmentSalesProfit =
    segmentSalesProfitResult.status === 'fulfilled' ? segmentSalesProfitResult.value : [];
  const segmentReturnRate =
    segmentReturnRateResult.status === 'fulfilled' ? segmentReturnRateResult.value : [];
  const topCategoryMaxProfit = Math.max(...topCategoryProfit.map((item) => item.profit), 0);
  const segmentMaxValue = Math.max(
    ...segmentSalesProfit.flatMap((item) => [item.sales, item.profit]),
    0,
  );
  const segmentMaxReturnRate = Math.max(...segmentReturnRate.map((item) => item.returnRate), 0);

  const lateByShipMode =
    lateByShipModeResult.status === 'fulfilled' ? lateByShipModeResult.value : [];
  const returnRateTop =
    returnRateTopResult.status === 'fulfilled' ? returnRateTopResult.value : [];

  const lateMaxTotal = Math.max(
    ...lateByShipMode.map((item) => item.onTime + item.late),
    0,
  );
  const returnRateTopMax = Math.max(
    ...returnRateTop.map((item) => item.returnRate),
    0,
  );

  const items = [
    { id: 'sales', label: 'Sales', value: compactMoney(summary.totalSales) },
    { id: 'profit', label: 'Profit', value: compactMoney(summary.totalProfit) },
    { id: 'orders', label: 'Total Orders', value: compactNumber(summary.totalOrders) },
    { id: 'return', label: 'Return Rate', value: percent(summary.returnRate) },
    { id: 'avgDays', label: 'Avg Delivery', value: daysOrDash(kpi.avgShipDays) },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-black text-on-primary-fixed">Operations Insights</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          High-level metrics for selected operational dimensions. Avg Delivery uses order-line Days
          (Ship Date - Order Date).
        </p>
      </div>

      {hasError ? (
        <div className="rounded-lg bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
          Some KPI data is temporarily unavailable. Showing partial or empty results.
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
        <FilterSelect
          name="city"
          label="City"
          options={filterOptions.cities}
          value={filters.city}
        />
        <fieldset className="inline-flex items-center gap-2 h-8 rounded-full bg-surface-container-lowest px-3 text-xs font-body text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(196,198,204,0.2)]">
          <legend className="sr-only">Top 5 dimension</legend>
          <span className="text-[11px] font-label">Top 5:</span>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="topRankBy"
              value="product"
              defaultChecked={topRankBy === 'product'}
              className="accent-primary"
            />
            Product
          </label>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="topRankBy"
              value="category"
              defaultChecked={topRankBy === 'category'}
              className="accent-primary"
            />
            Category
          </label>
        </fieldset>
        <div className="flex items-center gap-1.5 ml-auto">
          <a
            href={`/analytics${buildSharedResetQuery()}`}
            className="inline-flex items-center gap-1 rounded-full px-3 h-8 text-xs font-body text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Reset
          </a>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full px-4 h-8 text-xs font-body font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </form>

      <KpiGrid items={items} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <article className="bg-surface-container-lowest rounded-lg p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
          <h2 className="text-sm font-headline font-bold text-on-surface mb-4">Top Categories by Profit</h2>
          <div className="space-y-2">
            {topCategoryProfit.length === 0 ? (
              <div className="text-xs text-on-surface-variant">No data for selected filters.</div>
            ) : (
              topCategoryProfit.slice(0, 5).map((item, index) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">{item.category}</span>
                    <span className="font-semibold text-on-surface">{compactMoney(item.profit)}</span>
                  </div>
                  <div className="h-3 rounded bg-surface-variant/50 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${toBarPercent(item.profit, topCategoryMaxProfit)}%`,
                        backgroundColor: getChartColor(index),
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="bg-surface-container-lowest rounded-lg p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
          <h2 className="text-sm font-headline font-bold text-on-surface mb-4">Sales &amp; Profit by Segment</h2>
          <div className="space-y-3">
            {segmentSalesProfit.length === 0 ? (
              <div className="text-xs text-on-surface-variant">No data for selected filters.</div>
            ) : (
              segmentSalesProfit.map((item) => (
                <div key={item.segment} className="space-y-1">
                  <div className="text-xs font-semibold text-on-surface">{item.segment}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-[10px] text-on-surface-variant">Sales</span>
                      <div className="h-3 flex-1 rounded bg-surface-variant/50 overflow-hidden">
                        <div
                          className="h-full bg-[#90afc5] rounded"
                          style={{ width: `${toBarPercent(item.sales, segmentMaxValue)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-[10px] text-on-surface-variant">{compactMoney(item.sales)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-[10px] text-on-surface-variant">Profit</span>
                      <div className="h-3 flex-1 rounded bg-surface-variant/50 overflow-hidden">
                        <div
                          className="h-full bg-[#336b87] rounded"
                          style={{ width: `${toBarPercent(item.profit, segmentMaxValue)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-[10px] text-on-surface-variant">{compactMoney(item.profit)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="bg-surface-container-lowest rounded-lg p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
          <h2 className="text-sm font-headline font-bold text-on-surface mb-4">Return Rate by Segment</h2>
          <div className="space-y-2">
            {segmentReturnRate.length === 0 ? (
              <div className="text-xs text-on-surface-variant">No data for selected filters.</div>
            ) : (
              segmentReturnRate.map((item, index) => (
                <div key={item.segment}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">{item.segment}</span>
                    <span className="font-semibold text-on-surface">{percent(item.returnRate)}</span>
                  </div>
                  <div className="h-3 rounded bg-surface-variant/50 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${toBarPercent(item.returnRate, segmentMaxReturnRate)}%`,
                        backgroundColor: getChartColor(index),
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-headline font-bold text-on-surface">Delivery &amp; Operational Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <article className="bg-surface-container-lowest rounded-lg p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-headline font-bold text-on-surface">Late Delivery by Ship Mode</h3>
              <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#10b981]" /> On-Time
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#ef4444]" /> Late
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {lateByShipMode.length === 0 ? (
                <div className="text-xs text-on-surface-variant">No data for selected filters.</div>
              ) : (
                lateByShipMode.map((item) => {
                  const total = item.onTime + item.late;
                  const onTimePct = total > 0 ? (item.onTime / total) * 100 : 0;
                  const latePct = total > 0 ? (item.late / total) * 100 : 0;
                  const rowWidth = lateMaxTotal > 0 ? (total / lateMaxTotal) * 100 : 0;
                  return (
                    <div key={item.shipMode}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant">{item.shipMode}</span>
                        <span className="font-semibold text-on-surface">
                          {compactNumber(item.onTime)} / {compactNumber(item.late)}
                        </span>
                      </div>
                      <div className="h-3 rounded bg-surface-variant/30 overflow-hidden">
                        <div className="h-full flex" style={{ width: `${rowWidth}%` }}>
                          <div
                            className="h-full bg-[#10b981]"
                            style={{ width: `${onTimePct}%` }}
                            title={`On-Time: ${item.onTime}`}
                          />
                          <div
                            className="h-full bg-[#ef4444]"
                            style={{ width: `${latePct}%` }}
                            title={`Late: ${item.late}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="bg-surface-container-lowest rounded-lg p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-headline font-bold text-on-surface">
                Top 5 Return Rate by {topRankBy === 'category' ? 'Category' : 'Product'}
              </h3>
              <span className="text-[10px] text-on-surface-variant">min 5 orders</span>
            </div>
            <div className="space-y-2">
              {returnRateTop.length === 0 ? (
                <div className="text-xs text-on-surface-variant">
                  No data for selected filters (need at least 5 orders per item).
                </div>
              ) : (
                returnRateTop.map((item, index) => (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-on-surface-variant" title={item.name}>
                        {item.name}
                      </span>
                      <span className="shrink-0 font-semibold text-on-surface">
                        {percent(item.returnRate)}{' '}
                        <span className="text-[10px] font-normal text-on-surface-variant">
                          ({compactNumber(item.orders)})
                        </span>
                      </span>
                    </div>
                    <div className="h-3 rounded bg-surface-variant/50 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${toBarPercent(item.returnRate, returnRateTopMax)}%`,
                          backgroundColor: getTopReturnBarColor(index),
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

        </div>
      </div>

      <p className="text-xs text-on-surface-variant">
        Filtered lines: {kpi.totalLines.toLocaleString()}
      </p>
    </section>
  );
}

function toBarPercent(value: number, maxValue: number): number {
  if (maxValue <= 0) return 0;
  return Math.max(5, Math.min(100, (value / maxValue) * 100));
}

const CHART_PALETTE = ['#262F34', '#336B87', '#F1D3BC', '#615049', '#3B454B', '#90AFC5'];
const TOP_RETURN_PALETTE = ['#336B87', '#763626', '#90AFC5', '#2A3132', '#F1D3BC'];

function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

function getTopReturnBarColor(index: number): string {
  return TOP_RETURN_PALETTE[index % TOP_RETURN_PALETTE.length];
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
        className="appearance-none bg-transparent outline-none text-xs font-body cursor-pointer pr-1 max-w-[12rem]"
        aria-label={label}
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 w-3 h-3 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M3 5l3-3 3 3M3 7l3 3 3-3" />
      </svg>
    </div>
  );
}
