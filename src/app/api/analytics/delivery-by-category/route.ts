import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { buildWhereClause, extractFilters } from '@/lib/filters';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const filters = extractFilters(req.nextUrl.searchParams);
    const { sql: where, params } = buildWhereClause(filters);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         dcat.Category                                                                    AS category,
         ROUND(AVG(f.Days), 2)                                                           AS avgDays,
         ROUND(
           COUNT(CASE WHEN f.ShipStatus != 'On-Time' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2
         )                                                                               AS lateRate,
         COUNT(*)                                                                        AS orders
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
       GROUP BY dcat.CategoryID, dcat.Category
       ORDER BY avgDays DESC`,
      params,
    );

    return Response.json(
      (rows as RowDataPacket[]).map((r) => ({
        category: r.category,
        avgDays: Number(r.avgDays),
        lateRate: Number(r.lateRate),
        orders: Number(r.orders),
      })),
    );
  } catch (err) {
    console.error('[GET /api/analytics/delivery-by-category]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
