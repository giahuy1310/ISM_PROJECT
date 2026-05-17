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
         COALESCE(SUM(f.Sales), 0)                                                     AS totalSales,
         COALESCE(SUM(f.Profit), 0)                                                    AS totalProfit,
         COUNT(DISTINCT f.OrderID)                                                     AS totalOrders,
         ROUND(
           COUNT(CASE WHEN f.Returned = 'Yes' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2
         )                                                                             AS returnRate,
         ROUND(
           COUNT(CASE WHEN f.ShipStatus = 'On-Time' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2
         )                                                                             AS onTimeDeliveryRate
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
    return Response.json({
      totalSales: Number(row.totalSales ?? 0),
      totalProfit: Number(row.totalProfit ?? 0),
      totalOrders: Number(row.totalOrders ?? 0),
      returnRate: Number(row.returnRate ?? 0),
      onTimeDeliveryRate: Number(row.onTimeDeliveryRate ?? 0),
    });
  } catch (err) {
    console.error('[GET /api/analytics/summary]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
