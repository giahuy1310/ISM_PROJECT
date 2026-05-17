import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { buildWhereClause, extractFilters } from '@/lib/filters';
import { RowDataPacket } from 'mysql2';

type Granularity = 'day' | 'month' | 'year';

function bucketExpression(granularity: Granularity): string {
  switch (granularity) {
    case 'year':
      return "DATE_FORMAT(f.OrderDate, '%Y')";
    case 'month':
      return "DATE_FORMAT(f.OrderDate, '%Y-%m')";
    case 'day':
    default:
      return "DATE_FORMAT(f.OrderDate, '%Y-%m-%d')";
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const granularity = (sp.get('granularity') ?? 'month') as Granularity;
    const filters = extractFilters(sp);
    const { sql: where, params } = buildWhereClause(filters);

    const bucket = bucketExpression(granularity);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         ${bucket}                       AS bucket,
         COALESCE(SUM(f.Sales), 0)      AS sales,
         COALESCE(SUM(f.Profit), 0)     AS profit,
         COUNT(DISTINCT f.OrderID)      AS orders
       FROM fact_retailorder f
       JOIN dim_location          dl   ON f.PostalCode     = dl.PostalCode
       JOIN dim_customer          dc   ON f.CustomerID     = dc.CustomerID
       JOIN dim_customersegment   dcs  ON dc.CusSegmentID  = dcs.CusSegmentID
       JOIN dim_product           dp   ON f.ProductID      = dp.ProductID
       JOIN dim_subcategory       dsc  ON dp.SubCategoryID = dsc.SubCategoryID
       JOIN dim_category          dcat ON dsc.CategoryID   = dcat.CategoryID
       JOIN dim_shipmode          dsm  ON f.ShipModeID     = dsm.ShipModeID
       LEFT JOIN dim_retailsalespeople rsp ON f.RetailSalesPeopleID = rsp.RetailSalesPeopleID
       ${where}
       GROUP BY bucket
       ORDER BY bucket ASC`,
      params,
    );

    return Response.json(
      (rows as RowDataPacket[]).map((r) => ({
        bucket: r.bucket,
        sales: Number(r.sales),
        profit: Number(r.profit),
        orders: Number(r.orders),
      })),
    );
  } catch (err) {
    console.error('[GET /api/analytics/timeseries]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
