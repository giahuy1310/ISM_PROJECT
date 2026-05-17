import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';

  if (!q || q.length < 1) {
    return Response.json([]);
  }

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT PostalCode, City, State, Region, Country, Longitude AS longitude, Latitude AS latitude
       FROM dim_location
       WHERE PostalCode LIKE ? OR City LIKE ?
       ORDER BY PostalCode ASC
       LIMIT 10`,
      [`${q}%`, `${q}%`],
    );
    return Response.json(rows);
  } catch (err) {
    console.error('[GET /api/locations]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
