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
         c.CustomerID,
         c.CustomerName,
         cs.CusSegmentID,
         cs.Segment
       FROM dim_customer c
       JOIN dim_customersegment cs ON c.CusSegmentID = cs.CusSegmentID
       WHERE c.CustomerID = ?`,
      [id],
    );

    if (!(rows as RowDataPacket[]).length) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    return Response.json((rows as RowDataPacket[])[0]);
  } catch (err) {
    console.error('[GET /api/customers/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { CustomerName, CusSegmentID } = body as {
      CustomerName?: unknown;
      CusSegmentID?: unknown;
    };

    if (CustomerName === undefined && CusSegmentID === undefined) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }
    if (CustomerName !== undefined && typeof CustomerName !== 'string') {
      return Response.json({ error: 'CustomerName must be a string' }, { status: 400 });
    }
    if (CusSegmentID !== undefined && typeof CusSegmentID !== 'number') {
      return Response.json({ error: 'CusSegmentID must be a number' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: ExecuteValues[] = [];

    if (CustomerName !== undefined) { sets.push('CustomerName = ?'); values.push(CustomerName); }
    if (CusSegmentID !== undefined) { sets.push('CusSegmentID = ?'); values.push(CusSegmentID); }
    values.push(id);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE dim_customer SET ${sets.join(', ')} WHERE CustomerID = ?`,
      values,
    );

    if ((result as ResultSetHeader).affectedRows === 0) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    return Response.json({ updated: true });
  } catch (err) {
    console.error('[PUT /api/customers/[id]]', err);
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
      'DELETE FROM dim_customer WHERE CustomerID = ?',
      [id],
    );

    if ((result as ResultSetHeader).affectedRows === 0) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/customers/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
