import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { buildWhereClause, extractFilters } from '@/lib/filters';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const dimensionRaw = sp.get('dimension');
    const dimension = dimensionRaw === 'category' ? 'category' : 'product';

    const filters = extractFilters(sp);
    const { sql: where, params } = buildWhereClause(filters);

    const groupSelect =
      dimension === 'category'
        ? 'dcat.Category AS name'
        : 'dp.ProductName AS name';
    const groupBy =
      dimension === 'category'
        ? 'dcat.CategoryID, dcat.Category'
        : 'dp.ProductID, dp.ProductName';

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         ${groupSelect},
         ROUND(
           COUNT(CASE WHEN f.Returned = 'Yes' THEN 1 END) * 100.0
           / NULLIF(COUNT(*), 0),
           2
         ) AS returnRate,
         COUNT(*) AS orders
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
       GROUP BY ${groupBy}
       HAVING COUNT(*) >= 5
       ORDER BY returnRate DESC, orders DESC
       LIMIT 5`,
      params,
    );

    return Response.json(
      (rows as RowDataPacket[]).map((r) => ({
        name: String(r.name),
        returnRate: Number(r.returnRate ?? 0),
        orders: Number(r.orders ?? 0),
      })),
    );
  } catch (err) {
    console.error('[GET /api/analytics/return-rate-top]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
