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
         dsm.ShipModeID AS shipModeId,
         dsm.ShipMode   AS shipMode,
         COALESCE(agg.orders, 0)     AS orders,
         COALESCE(agg.avgDays, 0)    AS avgDays,
         COALESCE(agg.avgPrice, 0)   AS avgPrice,
         COALESCE(agg.avgCost, 0)    AS avgCost,
         COALESCE(agg.returnRate, 0) AS returnRate
       FROM dim_shipmode dsm
       LEFT JOIN (
         SELECT
           dsm2.ShipModeID AS shipModeId,
           COUNT(*) AS orders,
           AVG(f.Days) AS avgDays,
           AVG(f.Sales) AS avgPrice,
           AVG(f.Cost) AS avgCost,
           ROUND(
             100.0 * SUM(CASE WHEN f.Returned = 'Yes' THEN 1 ELSE 0 END)
                     / NULLIF(COUNT(*), 0),
             2
           ) AS returnRate
         FROM fact_retailorder f
         JOIN dim_location          dl   ON f.PostalCode     = dl.PostalCode
         JOIN dim_customer          dc   ON f.CustomerID     = dc.CustomerID
         JOIN dim_customersegment   dcs  ON dc.CusSegmentID  = dcs.CusSegmentID
         JOIN dim_product           dp   ON f.ProductID      = dp.ProductID
         JOIN dim_subcategory       dsc  ON dp.SubCategoryID = dsc.SubCategoryID
         JOIN dim_category          dcat ON dsc.CategoryID   = dcat.CategoryID
         JOIN dim_shipmode          dsm2 ON f.ShipModeID     = dsm2.ShipModeID
         LEFT JOIN dim_retailsalespeople rsp ON f.RetailSalesPeopleID = rsp.RetailSalesPeopleID
         ${where}
         GROUP BY dsm2.ShipModeID, dsm2.ShipMode
       ) agg ON dsm.ShipModeID = agg.shipModeId
       ORDER BY COALESCE(agg.orders, 0) DESC, dsm.ShipMode`,
      params,
    );

    return Response.json(
      (rows as RowDataPacket[]).map((r) => ({
        shipModeId: Number(r.shipModeId),
        shipMode: String(r.shipMode),
        orders: Number(r.orders),
        avgDays: Number(r.avgDays),
        avgPrice: Number(r.avgPrice),
        avgCost: Number(r.avgCost),
        returnRate: Number(r.returnRate),
      })),
    );
  } catch (err) {
    console.error('[GET /api/analytics/shipmode-stats]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
