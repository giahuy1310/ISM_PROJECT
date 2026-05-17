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
         COUNT(*) AS totalLines,
         COUNT(CASE WHEN f.ShipStatus IN ('On-Time', 'Late') THEN 1 END) AS linesWithDeliveryStatus,
         ROUND(
           COUNT(CASE WHEN f.ShipStatus = 'On-Time' THEN 1 END) * 100.0
           / NULLIF(COUNT(CASE WHEN f.ShipStatus IN ('On-Time', 'Late') THEN 1 END), 0),
           2
         ) AS onTimeDeliveryRate,
         ROUND(
           COUNT(CASE WHEN f.ShipStatus = 'Late' THEN 1 END) * 100.0
           / NULLIF(COUNT(CASE WHEN f.ShipStatus IN ('On-Time', 'Late') THEN 1 END), 0),
           2
         ) AS lateDeliveryRate,
         ROUND(
           COUNT(CASE WHEN f.Returned = 'Yes' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
           2
         ) AS returnRate,
         ROUND(AVG(CASE WHEN f.Days IS NOT NULL THEN f.Days END), 2) AS avgShipDays
       FROM fact_retailorder f
       JOIN dim_location          dl  ON f.PostalCode        = dl.PostalCode
       JOIN dim_customer          dc  ON f.CustomerID        = dc.CustomerID
       JOIN dim_customersegment   dcs ON dc.CusSegmentID     = dcs.CusSegmentID
       JOIN dim_product           dp  ON f.ProductID         = dp.ProductID
       JOIN dim_subcategory       dsc ON dp.SubCategoryID    = dsc.SubCategoryID
       JOIN dim_category          dcat ON dsc.CategoryID     = dcat.CategoryID
       JOIN dim_shipmode          dsm ON f.ShipModeID        = dsm.ShipModeID
       LEFT JOIN dim_retailsalespeople rsp ON f.RetailSalesPeopleID = rsp.RetailSalesPeopleID
       ${where}`,
      params,
    );

    const row = (rows as RowDataPacket[])[0] ?? {};
    const deliveryDenom = Number(row.linesWithDeliveryStatus ?? 0);

    const numOrNull = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return Response.json({
      onTimeDeliveryRate: deliveryDenom > 0 ? numOrNull(row.onTimeDeliveryRate) : null,
      lateDeliveryRate: deliveryDenom > 0 ? numOrNull(row.lateDeliveryRate) : null,
      returnRate: Number(row.returnRate ?? 0),
      avgShipDays: numOrNull(row.avgShipDays),
      linesWithDeliveryStatus: deliveryDenom,
      totalLines: Number(row.totalLines ?? 0),
    });
  } catch (err) {
    console.error('[GET /api/analytics/kpi]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
