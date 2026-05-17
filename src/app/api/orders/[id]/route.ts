import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { ExecuteValues } from 'mysql2';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         f.RetailOrderID, f.OrderID, f.OrderDate, f.ShipDate,
         f.ShipStatus, f.Returned, f.Sales, f.Quantity, f.Profit, f.Cost, f.Days,
         f.CustomerID, c.CustomerName, cs.Segment,
         f.ProductID, p.ProductName, sc.SubCategory, cat.Category,
         dsm.ShipMode,
         dl.City, dl.State, dl.Region, dl.Country, dl.PostalCode,
         rsp.RetailSalesPeople
       FROM fact_retailorder f
       JOIN dim_customer          c   ON f.CustomerID          = c.CustomerID
       JOIN dim_customersegment   cs  ON c.CusSegmentID        = cs.CusSegmentID
       JOIN dim_product           p   ON f.ProductID           = p.ProductID
       JOIN dim_subcategory       sc  ON p.SubCategoryID       = sc.SubCategoryID
       JOIN dim_category          cat ON sc.CategoryID         = cat.CategoryID
       JOIN dim_shipmode          dsm ON f.ShipModeID          = dsm.ShipModeID
       JOIN dim_location          dl  ON f.PostalCode          = dl.PostalCode
       JOIN dim_retailsalespeople rsp ON f.RetailSalesPeopleID = rsp.RetailSalesPeopleID
       WHERE f.RetailOrderID = ?`,
      [id],
    );

    if (!(rows as RowDataPacket[]).length) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    return Response.json((rows as RowDataPacket[])[0]);
  } catch (err) {
    console.error('[GET /api/orders/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json() as Record<string, ExecuteValues | undefined>;

    const allowedFields: Record<string, string> = {
      ShipDate: 'ShipDate',
      ShipModeID: 'ShipModeID',
      ShipStatus: 'ShipStatus',
      Returned: 'Returned',
      Sales: 'Sales',
      Quantity: 'Quantity',
      Profit: 'Profit',
      Cost: 'Cost',
      Days: 'Days',
    };

    const sets: string[] = [];
    const values: ExecuteValues[] = [];

    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        sets.push(`${col} = ?`);
        values.push(body[key]);
      }
    }

    if (!sets.length) {
      return Response.json({ error: 'No updatable fields provided' }, { status: 400 });
    }
    values.push(id);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE fact_retailorder SET ${sets.join(', ')} WHERE RetailOrderID = ?`,
      values,
    );

    if ((result as ResultSetHeader).affectedRows === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    return Response.json({ updated: true });
  } catch (err) {
    console.error('[PUT /api/orders/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM fact_retailorder WHERE RetailOrderID = ?',
      [id],
    );

    if ((result as ResultSetHeader).affectedRows === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/orders/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
