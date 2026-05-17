import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { ExecuteValues } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const search = sp.get('search') ?? '';
    const segment = sp.get('segment') ?? '';
    const page = Math.max(1, Number(sp.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 20)));
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    const params: ExecuteValues[] = [];

    if (search) {
      clauses.push('c.CustomerName LIKE ?');
      params.push(`%${search}%`);
    }
    if (segment) {
      clauses.push('cs.Segment = ?');
      params.push(segment);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [[{ total }]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM dim_customer c
       JOIN dim_customersegment cs ON c.CusSegmentID = cs.CusSegmentID
       ${where}`,
      params,
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         c.CustomerID,
         c.CustomerName,
         cs.CusSegmentID,
         cs.Segment
       FROM dim_customer c
       JOIN dim_customersegment cs ON c.CusSegmentID = cs.CusSegmentID
       ${where}
       ORDER BY c.CustomerName ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return Response.json({ data: rows, total: Number(total), page, limit });
  } catch (err) {
    console.error('[GET /api/customers]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { CustomerID, CustomerName, CusSegmentID } = body;

    if (!CustomerID || !CustomerName || !CusSegmentID) {
      return Response.json(
        { error: 'CustomerID, CustomerName, and CusSegmentID are required' },
        { status: 400 },
      );
    }

    await pool.execute<ResultSetHeader>(
      'INSERT INTO dim_customer (CustomerID, CustomerName, CusSegmentID) VALUES (?, ?, ?)',
      [CustomerID, CustomerName, CusSegmentID],
    );

    return Response.json({ CustomerID }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/customers]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
