import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { ExecuteValues } from 'mysql2';

const BASE_SELECT = `
  SELECT
    p.ProductID,
    p.ProductName,
    p.UnitCP,
    p.UnitSP,
    sc.SubCategoryID,
    sc.SubCategory,
    cat.CategoryID,
    cat.Category
  FROM dim_product p
  JOIN dim_subcategory sc  ON p.SubCategoryID = sc.SubCategoryID
  JOIN dim_category    cat ON sc.CategoryID   = cat.CategoryID
`;

const INITIAL_SUFFIX = 10000000;

type ProductMetaRow = RowDataPacket & {
  CategoryID: string | number;
  Category: string;
  SubCategoryID: string | number;
  SubCategory: string;
};

type CodeLookupRow = RowDataPacket & {
  Category: string;
  SubCategory: string;
};

type MaxSuffixRow = RowDataPacket & {
  maxSuffix: number | null;
};

function normalizeNameCode(source: string, expectedLength: number): string {
  const code = source
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, expectedLength);

  return code.padEnd(expectedLength, 'X');
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }

  return 'code' in err && err.code === 'ER_DUP_ENTRY';
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    if (sp.get('meta') === '1') {
      const [rows] = await pool.execute<ProductMetaRow[]>(
        `SELECT
          cat.CategoryID,
          cat.Category,
          sc.SubCategoryID,
          sc.SubCategory
        FROM dim_subcategory sc
        JOIN dim_category cat ON sc.CategoryID = cat.CategoryID
        ORDER BY cat.Category ASC, sc.SubCategory ASC`,
      );

      const categoriesMap = new Map<string, { categoryId: string; category: string; subCategories: Array<{ subCategoryId: number; subCategory: string }> }>();

      for (const row of rows) {
        const categoryId = String(row.CategoryID);
        const subCategoryId = Number(row.SubCategoryID);
        if (!Number.isFinite(subCategoryId)) {
          continue;
        }

        if (!categoriesMap.has(categoryId)) {
          categoriesMap.set(categoryId, {
            categoryId,
            category: String(row.Category),
            subCategories: [],
          });
        }

        categoriesMap.get(categoryId)?.subCategories.push({
          subCategoryId,
          subCategory: String(row.SubCategory),
        });
      }

      return Response.json({ categories: Array.from(categoriesMap.values()) });
    }

    const search = sp.get('search') ?? '';
    const page = Math.max(1, Number(sp.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 20)));
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    const params: ExecuteValues[] = [];

    if (search) {
      clauses.push('(p.ProductName LIKE ? OR cat.Category LIKE ? OR sc.SubCategory LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [[{ total }]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM dim_product p
       JOIN dim_subcategory sc  ON p.SubCategoryID = sc.SubCategoryID
       JOIN dim_category    cat ON sc.CategoryID   = cat.CategoryID
       ${where}`,
      params,
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      `${BASE_SELECT} ${where} ORDER BY p.ProductName ASC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return Response.json({ data: rows, total: Number(total), page, limit });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | null = null;

  try {
    const body = await req.json() as {
      ProductName?: unknown;
      SubCategoryID?: unknown;
      UnitCP?: unknown;
      UnitSP?: unknown;
    };
    const { ProductName, SubCategoryID, UnitCP, UnitSP } = body;

    const trimmedProductName = typeof ProductName === 'string' ? ProductName.trim() : '';
    if (!trimmedProductName) {
      return Response.json({ error: 'ProductName is required' }, { status: 400 });
    }

    const parsedSubCategoryId = Number(SubCategoryID);
    if (!Number.isInteger(parsedSubCategoryId) || parsedSubCategoryId <= 0) {
      return Response.json({ error: 'SubCategoryID must be a positive integer' }, { status: 400 });
    }

    const parsedUnitCP = parseOptionalNumber(UnitCP);
    if (UnitCP !== undefined && parsedUnitCP === undefined) {
      return Response.json({ error: 'UnitCP must be a valid number' }, { status: 400 });
    }

    const parsedUnitSP = parseOptionalNumber(UnitSP);
    if (UnitSP !== undefined && parsedUnitSP === undefined) {
      return Response.json({ error: 'UnitSP must be a valid number' }, { status: 400 });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [lookupRows] = await connection.execute<CodeLookupRow[]>(
      `SELECT
        cat.Category,
        sc.SubCategory
      FROM dim_subcategory sc
      JOIN dim_category cat ON sc.CategoryID = cat.CategoryID
      WHERE sc.SubCategoryID = ?
      FOR UPDATE`,
      [parsedSubCategoryId],
    );

    if (!lookupRows.length) {
      await connection.rollback();
      return Response.json({ error: 'SubCategoryID does not exist' }, { status: 400 });
    }

    const codes = lookupRows[0];
    const categoryCode = normalizeNameCode(String(codes.Category), 3);
    const subCategoryCode = normalizeNameCode(String(codes.SubCategory), 2);

    if (!categoryCode || !subCategoryCode) {
      await connection.rollback();
      return Response.json({ error: 'Invalid category/subcategory code for ProductID generation' }, { status: 400 });
    }

    const prefix = `${categoryCode}-${subCategoryCode}-`;
    const [maxRows] = await connection.execute<MaxSuffixRow[]>(
      `SELECT MAX(CAST(SUBSTRING_INDEX(ProductID, '-', -1) AS UNSIGNED)) AS maxSuffix
       FROM dim_product
       WHERE ProductID LIKE ?
       FOR UPDATE`,
      [`${prefix}%`],
    );

    const maxSuffix = Number(maxRows[0]?.maxSuffix ?? 0);
    const nextSuffix = maxSuffix > 0 ? maxSuffix + 1 : INITIAL_SUFFIX;
    const generatedProductId = `${prefix}${String(nextSuffix).padStart(8, '0')}`;

    await connection.execute<ResultSetHeader>(
      'INSERT INTO dim_product (ProductID, ProductName, SubCategoryID, UnitCP, UnitSP) VALUES (?, ?, ?, ?, ?)',
      [generatedProductId, trimmedProductName, parsedSubCategoryId, parsedUnitCP ?? null, parsedUnitSP ?? null],
    );

    await connection.commit();

    return Response.json({ ProductID: generatedProductId }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/products]', err);
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Ignore rollback failure and preserve original error handling.
      }
    }

    if (isDuplicateKeyError(err)) {
      return Response.json({ error: 'Generated ProductID already exists. Please retry.' }, { status: 409 });
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
