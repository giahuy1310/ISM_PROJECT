import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body as { query?: string };

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    if (!/^\s*INSERT\s+/i.test(query)) {
      return Response.json(
        { error: 'Only INSERT statements are allowed on this endpoint' },
        { status: 400 },
      );
    }

    const [result] = await pool.query<ResultSetHeader>(query);

    return Response.json(
      { success: true, insertId: result.insertId, affectedRows: result.affectedRows },
      { status: 201 },
    );
  } catch (err: unknown) {
    const mysqlErr = err as { message?: string; code?: string };
    return Response.json(
      { error: mysqlErr.message ?? 'Unknown error', code: mysqlErr.code },
      { status: 400 },
    );
  }
}
