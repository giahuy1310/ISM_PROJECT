import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

type ProductRow = RowDataPacket & {
  productId: string;
  productName: string;
  subCategory: string;
  sales: number;
  profit: number;
  returnRate: number;
  avgDeliveryDays: number;
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const productId = sp.get('productId')?.trim();
    const productName = sp.get('productName')?.trim();
    const subCategory = sp.get('subCategory')?.trim();

    const clauses: string[] = [];
    const params: string[] = [];

    if (productId) {
      clauses.push('dp.ProductID LIKE ?');
      params.push(`%${productId}%`);
    }
    if (productName) {
      clauses.push('dp.ProductName LIKE ?');
      params.push(`%${productName}%`);
    }
    if (subCategory) {
      clauses.push('dsc.SubCategory LIKE ?');
      params.push(`%${subCategory}%`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [rows] = await pool.execute<ProductRow[]>(
      `SELECT
         dp.ProductID AS productId,
         dp.ProductName AS productName,
         dsc.SubCategory AS subCategory,
         COALESCE(SUM(f.Sales), 0) AS sales,
         COALESCE(SUM(f.Profit), 0) AS profit,
         ROUND(
           COUNT(CASE WHEN f.Returned = 'Yes' THEN 1 END) * 100.0
           / NULLIF(COUNT(f.ProductID), 0),
           2
         ) AS returnRate,
         ROUND(COALESCE(AVG(f.Days), 0), 2) AS avgDeliveryDays
       FROM dim_product dp
       LEFT JOIN fact_retailorder f ON f.ProductID = dp.ProductID
       JOIN dim_subcategory dsc ON dp.SubCategoryID = dsc.SubCategoryID
       ${where}
       GROUP BY dp.ProductID, dp.ProductName, dsc.SubCategory
       ORDER BY dp.ProductName ASC`,
      params,
    );

    return Response.json(
      rows.map((row) => ({
        productId: String(row.productId),
        productName: String(row.productName),
        subCategory: String(row.subCategory),
        sales: Number(row.sales ?? 0),
        profit: Number(row.profit ?? 0),
        returnRate: Number(row.returnRate ?? 0),
        avgDeliveryDays: Number(row.avgDeliveryDays ?? 0),
      })),
    );
  } catch (err) {
    console.error('[GET /api/analytics/products]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
