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
         p.ProductID, p.ProductName, p.UnitCP, p.UnitSP,
         sc.SubCategoryID, sc.SubCategory,
         cat.CategoryID, cat.Category
       FROM dim_product p
       JOIN dim_subcategory sc  ON p.SubCategoryID = sc.SubCategoryID
       JOIN dim_category    cat ON sc.CategoryID   = cat.CategoryID
       WHERE p.ProductID = ?`,
      [id],
    );

    if (!(rows as RowDataPacket[]).length) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    return Response.json((rows as RowDataPacket[])[0]);
  } catch (err) {
    console.error('[GET /api/products/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      ProductName?: unknown;
      SubCategoryID?: unknown;
      UnitCP?: unknown;
      UnitSP?: unknown;
    };
    const { ProductName, SubCategoryID, UnitCP, UnitSP } = body;

    if (!ProductName && SubCategoryID === undefined && UnitCP === undefined && UnitSP === undefined) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }
    if (ProductName !== undefined && typeof ProductName !== 'string') {
      return Response.json({ error: 'ProductName must be a string' }, { status: 400 });
    }
    if (SubCategoryID !== undefined && typeof SubCategoryID !== 'number') {
      return Response.json({ error: 'SubCategoryID must be a number' }, { status: 400 });
    }
    if (UnitCP !== undefined && typeof UnitCP !== 'number') {
      return Response.json({ error: 'UnitCP must be a number' }, { status: 400 });
    }
    if (UnitSP !== undefined && typeof UnitSP !== 'number') {
      return Response.json({ error: 'UnitSP must be a number' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: ExecuteValues[] = [];

    if (ProductName !== undefined) { sets.push('ProductName = ?'); values.push(ProductName); }
    if (SubCategoryID !== undefined) { sets.push('SubCategoryID = ?'); values.push(SubCategoryID); }
    if (UnitCP !== undefined) { sets.push('UnitCP = ?'); values.push(UnitCP); }
    if (UnitSP !== undefined) { sets.push('UnitSP = ?'); values.push(UnitSP); }
    values.push(id);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE dim_product SET ${sets.join(', ')} WHERE ProductID = ?`,
      values,
    );

    if ((result as ResultSetHeader).affectedRows === 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    return Response.json({ updated: true });
  } catch (err) {
    console.error('[PUT /api/products/[id]]', err);
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
      'DELETE FROM dim_product WHERE ProductID = ?',
      [id],
    );

    if ((result as ResultSetHeader).affectedRows === 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/products/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
