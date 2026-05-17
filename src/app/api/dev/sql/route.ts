import { type NextRequest } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { auth } from '@/auth';
import pool from '@/lib/db';

type SqlBody = {
  query?: string;
};

function isResultSetHeader(value: unknown): value is ResultSetHeader {
  return typeof value === 'object' && value !== null && 'affectedRows' in value;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as SqlBody;
    const query = body.query;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    const [result, fields] = await pool.query(query);

    if (Array.isArray(result)) {
      const rows = result as RowDataPacket[];
      return Response.json(
        {
          success: true,
          rowCount: rows.length,
          rows,
          fields: Array.isArray(fields) ? fields.map((field) => field.name) : [],
        },
        { status: 200 },
      );
    }

    if (isResultSetHeader(result)) {
      return Response.json(
        {
          success: true,
          rowCount: Number(result.affectedRows ?? 0),
          affectedRows: Number(result.affectedRows ?? 0),
          insertId: Number(result.insertId ?? 0),
        },
        { status: 200 },
      );
    }

    return Response.json({ success: true, rowCount: 0 }, { status: 200 });
  } catch (err: unknown) {
    const mysqlErr = err as { message?: string; code?: string };
    return Response.json(
      { error: mysqlErr.message ?? 'Unknown error', code: mysqlErr.code },
      { status: 400 },
    );
  }
}
