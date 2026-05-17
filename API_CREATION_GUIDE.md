# API Creation Guide

This project uses Next.js App Router API routes under `src/app/api`.

## 1) Choose endpoint path

- Create a folder in `src/app/api`.
- Add a `route.ts` file.
- Path mapping example:
  - `src/app/api/analytics/region-performance/route.ts`
  - endpoint: `GET /api/analytics/region-performance`

## 2) Create route handler

Use named exports for HTTP methods (`GET`, `POST`, `PUT`, `DELETE`).

```ts
import { type NextRequest } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const region = sp.get('region');

    const [rows] = await pool.execute(
      'SELECT * FROM your_table WHERE (? IS NULL OR Region = ?)',
      [region, region],
    );

    return Response.json(rows);
  } catch (err) {
    console.error('[GET /api/your-endpoint]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## 3) Use database pool and parameterized SQL

- Import DB pool from `src/lib/db.ts`.
- Always use placeholders (`?`) in SQL and pass values as params.
- Avoid string-concatenated SQL.

## 4) Parse and validate input

- Query params: `req.nextUrl.searchParams`.
- JSON body: `await req.json()`.
- Return `400` for missing or invalid required input.

## 5) Return consistent status codes

- `200` for success reads/updates.
- `201` for successful create.
- `400` for invalid request data.
- `404` for missing resource.
- `500` for unexpected errors.

## 6) Dynamic route pattern (`[id]`)

For endpoints like `/api/orders/[id]`, use:

```ts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // query by id...
}
```

## 7) Reuse analytics filter helpers when needed

For analytics endpoints, reuse:

- `extractFilters(searchParams)`
- `buildWhereClause(filters)`

from `src/lib/filters.ts`.

## 8) Update frontend API client

If the endpoint is used in dashboard/analytics pages, add a typed function in:

- `src/app/(app)/dashboard/analytics-api.ts`

Use the same fetch pattern and response typing used by existing functions.

## 9) Test with Postman

1. Run app: `npm run dev`
2. Send request to `http://localhost:3000/api/...`
3. For query filters, use Postman **Params** tab.
4. For `POST`/`PUT`, set Body to raw JSON and `Content-Type: application/json`.
5. Verify status code and JSON response body.
