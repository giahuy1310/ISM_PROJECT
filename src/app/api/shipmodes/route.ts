import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = body?.ShipMode;
    if (typeof raw !== 'string') {
      return Response.json({ error: 'ShipMode is required' }, { status: 400 });
    }
    const ShipMode = raw.trim();
    if (!ShipMode) {
      return Response.json({ error: 'ShipMode cannot be empty' }, { status: 400 });
    }
    if (ShipMode.length > 50) {
      return Response.json({ error: 'ShipMode cannot exceed 50 characters' }, { status: 400 });
    }

    const [dupRows] = await pool.execute<RowDataPacket[]>(
      'SELECT ShipModeID FROM dim_shipmode WHERE LOWER(ShipMode) = LOWER(?) LIMIT 1',
      [ShipMode],
    );
    if ((dupRows as RowDataPacket[])[0]) {
      return Response.json({ error: 'A ship mode with this name already exists' }, { status: 400 });
    }

    const [nextRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(ShipModeID), 0) + 1 AS nextId FROM dim_shipmode',
    );
    const nextRow = (nextRows as RowDataPacket[])[0];
    const nextId = Number(nextRow?.nextId);
    if (!Number.isFinite(nextId)) {
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    await pool.execute<ResultSetHeader>(
      'INSERT INTO dim_shipmode (ShipModeID, ShipMode) VALUES (?, ?)',
      [nextId, ShipMode],
    );

    return Response.json({ ShipModeID: nextId, ShipMode }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/shipmodes]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
