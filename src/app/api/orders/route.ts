import { type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const ORDER_SELECT = `
  SELECT
    f.RetailOrderID,
    f.OrderID,
    f.OrderDate,
    f.ShipDate,
    f.ShipStatus,
    f.Returned,
    f.Sales,
    f.Quantity,
    f.Profit,
    f.Cost,
    f.Days,
    f.CustomerID,
    c.CustomerName,
    cs.Segment,
    f.ProductID,
    p.ProductName,
    sc.SubCategory,
    cat.Category,
    dsm.ShipMode,
    dl.City,
    dl.State,
    dl.Region,
    dl.Country,
    rsp.RetailSalesPeople
  FROM fact_retailorder f
  JOIN dim_customer          c   ON f.CustomerID          = c.CustomerID
  JOIN dim_customersegment   cs  ON c.CusSegmentID        = cs.CusSegmentID
  JOIN dim_product           p   ON f.ProductID           = p.ProductID
  JOIN dim_subcategory       sc  ON p.SubCategoryID       = sc.SubCategoryID
  JOIN dim_category          cat ON sc.CategoryID         = cat.CategoryID
  JOIN dim_shipmode          dsm ON f.ShipModeID          = dsm.ShipModeID
  JOIN dim_location          dl  ON f.PostalCode          = dl.PostalCode
  JOIN dim_retailsalespeople rsp ON f.RetailSalesPeopleID = rsp.RetailSalesPeopleID
`;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const rawPage = Number(sp.get('page') ?? 1);
    const rawLimit = Number(sp.get('limit') ?? 20);
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    // mysql2 expects a concrete value type for prepared statements; all searchParams values are strings.
    const params: string[] = [];

    const customerId = sp.get('customerId');
    const productId = sp.get('productId');
    const retailOrderId = sp.get('retailOrderId');
    const orderId = sp.get('orderId');
    const shipDate = sp.get('shipDate');
    const shipStartDate = sp.get('shipStartDate');
    const shipEndDate = sp.get('shipEndDate');
    const shipStatus = sp.get('shipStatus');
    const shipModeId = sp.get('shipModeId');
    const postalCode = sp.get('postalCode');
    const location = sp.get('location');
    const retailSalesPeopleId = sp.get('retailSalesPeopleId');
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');
    const region = sp.get('region');
    const returned = sp.get('returned');

    if (retailOrderId) { clauses.push('f.RetailOrderID = ?'); params.push(retailOrderId); }
    if (orderId) { clauses.push('f.OrderID LIKE ?'); params.push(`%${orderId}%`); }
    if (customerId) { clauses.push('f.CustomerID = ?'); params.push(customerId); }
    if (productId) { clauses.push('f.ProductID = ?'); params.push(productId); }
    if (startDate) { clauses.push('f.OrderDate >= ?'); params.push(startDate); }
    if (endDate) { clauses.push('f.OrderDate <= ?'); params.push(endDate); }
    if (shipStartDate) { clauses.push('DATE(f.ShipDate) >= ?'); params.push(shipStartDate); }
    if (shipEndDate) { clauses.push('DATE(f.ShipDate) <= ?'); params.push(shipEndDate); }
    if (!shipStartDate && !shipEndDate && shipDate) { clauses.push('DATE(f.ShipDate) = ?'); params.push(shipDate); }
    if (shipStatus) { clauses.push('f.ShipStatus = ?'); params.push(shipStatus); }
    if (shipModeId) { clauses.push('f.ShipModeID = ?'); params.push(shipModeId); }
    if (location) {
      const like = `%${location}%`;
      clauses.push(`(f.PostalCode LIKE ? OR dl.Region LIKE ? OR dl.State LIKE ? OR dl.Country LIKE ?)`);
      params.push(like, like, like, like);
    }
    if (postalCode) { clauses.push('f.PostalCode = ?'); params.push(postalCode); }
    if (retailSalesPeopleId) { clauses.push('f.RetailSalesPeopleID = ?'); params.push(retailSalesPeopleId); }
    if (region) { clauses.push('dl.Region = ?'); params.push(region); }
    if (returned) { clauses.push('f.Returned = ?'); params.push(returned); }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [[{ total }]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM fact_retailorder f
       JOIN dim_location dl ON f.PostalCode = dl.PostalCode
       ${where}`,
      params,
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      `${ORDER_SELECT} ${where} ORDER BY f.OrderDate DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return Response.json({ data: rows, total: Number(total), page, limit });
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      OrderID, OrderDate, ShipDate, ShipModeID, CustomerID,
      PostalCode, RetailSalesPeopleID, ProductID,
      Returned, ShipStatus, Sales, Quantity, Profit, Cost, Days,
    } = body;

    if (!OrderID || !OrderDate || !CustomerID || !ProductID) {
      return Response.json(
        { error: 'OrderID, OrderDate, CustomerID, and ProductID are required' },
        { status: 400 },
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO fact_retailorder
         (OrderID, OrderDate, ShipDate, ShipModeID, CustomerID, PostalCode,
          RetailSalesPeopleID, ProductID, Returned, ShipStatus, Sales, Quantity, Profit, Cost, Days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        OrderID, OrderDate, ShipDate ?? null, ShipModeID ?? null, CustomerID,
        PostalCode ?? null, RetailSalesPeopleID ?? null, ProductID,
        Returned ?? null, ShipStatus ?? null,
        Sales ?? null, Quantity ?? null, Profit ?? null, Cost ?? null, Days ?? null,
      ],
    );

    return Response.json({ RetailOrderID: (result as ResultSetHeader).insertId }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/orders]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
