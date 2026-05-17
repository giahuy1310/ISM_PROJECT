export type SellerOption = {
  retailSalesPeopleId: number;
  name: string;
};

export type FiltersResponse = {
  countries: string[];
  regions: string[];
  states: string[];
  cities: string[];
  months: number[];
  years: number[];
  segments: string[];
  categories: string[];
  subCategories: string[];
  shipModes: string[];
  sellers: SellerOption[];
  dateRange: { earliestDate: string | null; latestDate: string | null };
};

export type SummaryResponse = {
  totalSales: number;
  totalProfit: number;
  totalOrders: number;
  returnRate: number;
  onTimeDeliveryRate: number;
};

export type TimeseriesPoint = {
  bucket: string;
  sales: number;
  profit: number;
  orders: number;
};

export type RegionPerformancePoint = {
  region: string;
  sales: number;
  profit: number;
  lateRate: number;
  orders: number;
};

export type DeliveryByCategoryPoint = {
  category: string;
  avgDays: number;
  lateRate: number;
  orders: number;
};

export type ShipModePoint = {
  shipMode: string;
  orders: number;
  percent: number;
};

export type ShipModeStatsPoint = {
  shipModeId: number;
  shipMode: string;
  orders: number;
  avgDays: number;
  avgPrice: number;
  avgCost: number;
  returnRate: number;
};

export type TopCategoryProfitPoint = {
  category: string;
  profit: number;
};

export type SegmentSalesProfitPoint = {
  segment: string;
  sales: number;
  profit: number;
};

export type SegmentReturnRatePoint = {
  segment: string;
  returnRate: number;
};

export type LateByShipModePoint = {
  shipMode: string;
  onTime: number;
  late: number;
};

export type DeliveryDistributionPoint = {
  days: number;
  orders: number;
};

export type ReturnRateTopPoint = {
  name: string;
  returnRate: number;
  orders: number;
};

export type OrderSizeImpactPoint = {
  days: number;
  quantity: number;
  sales: number;
  returned: 'Yes' | 'No';
};

export type ProductTablePoint = {
  productId: string;
  productName: string;
  subCategory: string;
  sales: number;
  profit: number;
  returnRate: number;
  avgDeliveryDays: number;
};

export type ProductSubCategoryOption = {
  subCategoryId: number;
  subCategory: string;
};

export type ProductCategoryOption = {
  categoryId: string;
  category: string;
  subCategories: ProductSubCategoryOption[];
};

export type ProductMetaResponse = {
  categories: ProductCategoryOption[];
};

export type AnalyticsFilters = {
  country?: string;
  region?: string;
  state?: string;
  city?: string;
  segment?: string;
  category?: string;
  subCategory?: string;
  shipMode?: string;
  months?: string[];
  years?: string[];
  startDate?: string;
  endDate?: string;
  retailSalesPeopleId?: string;
};

export type KpiMetricsResponse = {
  /** % of lines with ShipStatus On-Time among lines where status is On-Time or Late */
  onTimeDeliveryRate: number | null;
  /** % Late among same denominator */
  lateDeliveryRate: number | null;
  /** % Returned = Yes among all filtered lines */
  returnRate: number;
  /** Average ship lead time (Days) where Days is present */
  avgShipDays: number | null;
  linesWithDeliveryStatus: number;
  totalLines: number;
};

function buildQuery(params: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item !== '') sp.append(k === 'months' ? 'month' : k === 'years' ? 'year' : k, item);
      }
      continue;
    }
    if (v !== undefined && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function fetchJson<T>(path: string): Promise<T> {
  const base = process.env.BACKEND_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export function getFilters(): Promise<FiltersResponse> {
  return fetchJson<FiltersResponse>('/api/analytics/filters');
}

export function getSummary(filters: AnalyticsFilters): Promise<SummaryResponse> {
  return fetchJson<SummaryResponse>(`/api/analytics/summary${buildQuery(filters)}`);
}

export function getTimeseries(
  filters: AnalyticsFilters & { granularity?: 'day' | 'month' | 'year' },
): Promise<TimeseriesPoint[]> {
  return fetchJson<TimeseriesPoint[]>(`/api/analytics/timeseries${buildQuery(filters)}`);
}

export function getRegionPerformance(
  filters: AnalyticsFilters,
): Promise<RegionPerformancePoint[]> {
  return fetchJson<RegionPerformancePoint[]>(
    `/api/analytics/region-performance${buildQuery(filters)}`,
  );
}

export function getDeliveryByCategory(
  filters: AnalyticsFilters,
): Promise<DeliveryByCategoryPoint[]> {
  return fetchJson<DeliveryByCategoryPoint[]>(
    `/api/analytics/delivery-by-category${buildQuery(filters)}`,
  );
}

export function getShipMode(filters: AnalyticsFilters): Promise<ShipModePoint[]> {
  return fetchJson<ShipModePoint[]>(`/api/analytics/ship-mode${buildQuery(filters)}`);
}

export function getShipModeStats(filters: AnalyticsFilters): Promise<ShipModeStatsPoint[]> {
  return fetchJson<ShipModeStatsPoint[]>(`/api/analytics/shipmode-stats${buildQuery(filters)}`);
}

export function getKpiMetrics(filters: AnalyticsFilters): Promise<KpiMetricsResponse> {
  return fetchJson<KpiMetricsResponse>(`/api/analytics/kpi${buildQuery(filters)}`);
}

export function getTopCategoriesProfit(
  filters: AnalyticsFilters,
): Promise<TopCategoryProfitPoint[]> {
  return fetchJson<TopCategoryProfitPoint[]>(
    `/api/analytics/top-categories-profit${buildQuery(filters)}`,
  );
}

export function getSegmentSalesProfit(
  filters: AnalyticsFilters,
): Promise<SegmentSalesProfitPoint[]> {
  return fetchJson<SegmentSalesProfitPoint[]>(
    `/api/analytics/segment-sales-profit${buildQuery(filters)}`,
  );
}

export function getSegmentReturnRate(
  filters: AnalyticsFilters,
): Promise<SegmentReturnRatePoint[]> {
  return fetchJson<SegmentReturnRatePoint[]>(
    `/api/analytics/segment-return-rate${buildQuery(filters)}`,
  );
}

export function getLateByShipMode(
  filters: AnalyticsFilters,
): Promise<LateByShipModePoint[]> {
  return fetchJson<LateByShipModePoint[]>(
    `/api/analytics/late-by-shipmode${buildQuery(filters)}`,
  );
}

export function getDeliveryDistribution(
  filters: AnalyticsFilters,
): Promise<DeliveryDistributionPoint[]> {
  return fetchJson<DeliveryDistributionPoint[]>(
    `/api/analytics/delivery-distribution${buildQuery(filters)}`,
  );
}

export function getReturnRateTop(
  filters: AnalyticsFilters,
  dimension: 'product' | 'category',
): Promise<ReturnRateTopPoint[]> {
  return fetchJson<ReturnRateTopPoint[]>(
    `/api/analytics/return-rate-top${buildQuery({ ...filters, dimension })}`,
  );
}

export function getOrderSizeImpact(
  filters: AnalyticsFilters,
): Promise<OrderSizeImpactPoint[]> {
  return fetchJson<OrderSizeImpactPoint[]>(
    `/api/analytics/order-size-impact${buildQuery(filters)}`,
  );
}

export function getProductsTable(): Promise<ProductTablePoint[]> {
  return fetchJson<ProductTablePoint[]>('/api/analytics/products');
}

export function getProductMeta(): Promise<ProductMetaResponse> {
  return fetchJson<ProductMetaResponse>('/api/products?meta=1');
}
