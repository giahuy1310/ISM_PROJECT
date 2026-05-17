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
         dsm.ShipMode AS shipMode,
         COUNT(CASE WHEN f.ShipStatus = 'On-Time' THEN 1 END) AS onTime,
         COUNT(CASE WHEN f.ShipStatus = 'Late'    THEN 1 END) AS late
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
       GROUP BY dsm.ShipModeID, dsm.ShipMode
       ORDER BY (COUNT(CASE WHEN f.ShipStatus = 'On-Time' THEN 1 END)
               + COUNT(CASE WHEN f.ShipStatus = 'Late'    THEN 1 END)) DESC`,
      params,
    );

    return Response.json(
      (rows as RowDataPacket[]).map((r) => ({
        shipMode: String(r.shipMode),
        onTime: Number(r.onTime),
        late: Number(r.late),
      })),
    );
  } catch (err) {
    console.error('[GET /api/analytics/late-by-shipmode]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
