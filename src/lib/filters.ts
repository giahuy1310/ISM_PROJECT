export interface AnalyticsFilterParams {
  country?: string | null;
  region?: string | null;
  state?: string | null;
  city?: string | null;
  segment?: string | null;
  category?: string | null;
  subCategory?: string | null;
  shipMode?: string | null;
  months?: string[] | null;
  years?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
  /** dim_retailsalespeople.RetailSalesPeopleID */
  retailSalesPeopleId?: string | null;
}

export interface WhereClause {
  sql: string;
  params: (string | number | boolean | null)[];
}

/**
 * Builds a parameterized WHERE clause from analytics filter params.
 * Assumes the following table aliases are present in the query:
 *   f  = fact_retailorder
 *   dl = dim_location
 *   dc = dim_customer
 *   dcs = dim_customersegment
 *   dcat = dim_category
 *   dsc = dim_subcategory
 *   dsm = dim_shipmode
 *   rsp = dim_retailsalespeople
 */
export function buildWhereClause(filters: AnalyticsFilterParams): WhereClause {
  const clauses: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  if (filters.country) {
    clauses.push('dl.Country = ?');
    params.push(filters.country);
  }
  if (filters.region) {
    clauses.push('dl.Region = ?');
    params.push(filters.region);
  }
  if (filters.state) {
    clauses.push('dl.State = ?');
    params.push(filters.state);
  }
  if (filters.city) {
    clauses.push('dl.City = ?');
    params.push(filters.city);
  }
  if (filters.segment) {
    clauses.push('dcs.Segment = ?');
    params.push(filters.segment);
  }
  if (filters.category) {
    clauses.push('dcat.Category = ?');
    params.push(filters.category);
  }
  if (filters.subCategory) {
    clauses.push('dsc.SubCategory = ?');
    params.push(filters.subCategory);
  }
  if (filters.shipMode) {
    clauses.push('dsm.ShipMode = ?');
    params.push(filters.shipMode);
  }
  const years = (filters.years ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1900 && value <= 3000);
  const months = (filters.months ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12);
  if (years.length > 0) {
    clauses.push(`YEAR(f.OrderDate) IN (${years.map(() => '?').join(', ')})`);
    params.push(...years);
    if (months.length > 0) {
      clauses.push(`MONTH(f.OrderDate) IN (${months.map(() => '?').join(', ')})`);
      params.push(...months);
    }
  }
  if (filters.startDate) {
    clauses.push('f.OrderDate >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    clauses.push('f.OrderDate <= ?');
    params.push(filters.endDate);
  }
  if (filters.retailSalesPeopleId) {
    const id = Number(filters.retailSalesPeopleId);
    if (Number.isFinite(id)) {
      clauses.push('rsp.RetailSalesPeopleID = ?');
      params.push(id);
    }
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function extractFilters(searchParams: URLSearchParams): AnalyticsFilterParams {
  return {
    country: searchParams.get('country'),
    region: searchParams.get('region'),
    state: searchParams.get('state'),
    city: searchParams.get('city'),
    segment: searchParams.get('segment'),
    category: searchParams.get('category'),
    subCategory: searchParams.get('subCategory'),
    shipMode: searchParams.get('shipMode'),
    months: searchParams.getAll('month'),
    years: searchParams.getAll('year'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    retailSalesPeopleId: searchParams.get('retailSalesPeopleId'),
  };
}
