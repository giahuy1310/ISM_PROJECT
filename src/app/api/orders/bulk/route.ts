import { type NextRequest } from 'next/server';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { ExecuteValues } from 'mysql2';
import pool from '@/lib/db';

type RawRow = Record<string, unknown>;

type EtlRow = {
  OrderID: string;
  OrderDate: string;
  ShipDate: string | null;
  ShipModeID: number | null;
  CustomerID: string;
  PostalCode: string | null;
  RetailSalesPeopleID: number | null;
  ProductID: string;
  Returned: 'Yes' | 'No' | null;
  ShipStatus: 'On-Time' | 'Late' | null;
  Sales: number | null;
  Quantity: number | null;
  Profit: number | null;
  Cost: number | null;
  Days: number | null;
};

type RowIssue = {
  row: number;
  message: string;
};

type TransformedEntry = {
  sourceRow: number;
  row: EtlRow;
};

const MAX_ROWS = 1000;

function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function asNullableInt(value: unknown): number | null {
  const n = asNullableNumber(value);
  if (n === null) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseReturned(value: unknown): 'Yes' | 'No' | null {
  const s = asTrimmedString(value);
  if (!s) return null;
  const normalized = s.toLowerCase();
  if (normalized === 'yes') return 'Yes';
  if (normalized === 'no') return 'No';
  return null;
}

function parseShipStatus(value: unknown): 'On-Time' | 'Late' | null {
  const s = asTrimmedString(value);
  if (!s) return null;
  const normalized = s.toLowerCase();
  if (normalized === 'on-time' || normalized === 'ontime') return 'On-Time';
  if (normalized === 'late') return 'Late';
  return null;
}

function transformRow(raw: RawRow, excelRowNumber: number): { row: EtlRow | null; issues: RowIssue[] } {
  const issues: RowIssue[] = [];

  const orderId = asTrimmedString(raw.OrderID);
  const customerId = asTrimmedString(raw.CustomerID);
  const productId = asTrimmedString(raw.ProductID);
  const orderDate = normalizeDate(raw.OrderDate);
  const shipDate = normalizeDate(raw.ShipDate);

  if (!orderId) issues.push({ row: excelRowNumber, message: 'OrderID is required' });
  if (!customerId) issues.push({ row: excelRowNumber, message: 'CustomerID is required' });
  if (!productId) issues.push({ row: excelRowNumber, message: 'ProductID is required' });
  if (!orderDate) issues.push({ row: excelRowNumber, message: 'OrderDate must be a valid date' });

  const shipModeId = asNullableInt(raw.ShipModeID);
  const salesPeopleId = asNullableInt(raw.RetailSalesPeopleID);
  const quantity = asNullableInt(raw.Quantity);

  if (raw.ShipModeID !== null && raw.ShipModeID !== undefined && raw.ShipModeID !== '' && shipModeId === null) {
    issues.push({ row: excelRowNumber, message: 'ShipModeID must be an integer' });
  }
  if (
    raw.RetailSalesPeopleID !== null
    && raw.RetailSalesPeopleID !== undefined
    && raw.RetailSalesPeopleID !== ''
    && salesPeopleId === null
  ) {
    issues.push({ row: excelRowNumber, message: 'RetailSalesPeopleID must be an integer' });
  }
  if (raw.Quantity !== null && raw.Quantity !== undefined && raw.Quantity !== '' && quantity === null) {
    issues.push({ row: excelRowNumber, message: 'Quantity must be an integer' });
  }

  const returned = parseReturned(raw.Returned);
  if (raw.Returned !== null && raw.Returned !== undefined && raw.Returned !== '' && returned === null) {
    issues.push({ row: excelRowNumber, message: 'Returned must be "Yes" or "No"' });
  }

  const shipStatus = parseShipStatus(raw.ShipStatus);
  if (raw.ShipStatus !== null && raw.ShipStatus !== undefined && raw.ShipStatus !== '' && shipStatus === null) {
    issues.push({ row: excelRowNumber, message: 'ShipStatus must be "On-Time" or "Late"' });
  }

  const sales = asNullableNumber(raw.Sales);
  const cost = asNullableNumber(raw.Cost);
  let profit = asNullableNumber(raw.Profit);

  if (sales !== null && cost !== null) {
    // Normalize derived metric server-side even if spreadsheet formula differs.
    profit = Number((sales - cost).toFixed(2));
  }

  let days = asNullableInt(raw.Days);
  if (orderDate && shipDate) {
    const orderTs = new Date(orderDate).getTime();
    const shipTs = new Date(shipDate).getTime();
    if (shipTs < orderTs) {
      issues.push({ row: excelRowNumber, message: 'ShipDate cannot be before OrderDate' });
    } else {
      days = Math.round((shipTs - orderTs) / 86_400_000);
    }
  }

  const postalCode = asTrimmedString(raw.PostalCode);

  if (issues.length > 0 || !orderId || !customerId || !productId || !orderDate) {
    return { row: null, issues };
  }

  return {
    row: {
      OrderID: orderId,
      OrderDate: orderDate,
      ShipDate: shipDate,
      ShipModeID: shipModeId,
      CustomerID: customerId,
      PostalCode: postalCode,
      RetailSalesPeopleID: salesPeopleId,
      ProductID: productId,
      Returned: returned,
      ShipStatus: shipStatus,
      Sales: sales,
      Quantity: quantity,
      Profit: profit,
      Cost: cost,
      Days: days,
    },
    issues,
  };
}

async function fetchValidSet(query: string, params: ExecuteValues[] = []): Promise<Set<string>> {
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return new Set(rows.map((r) => String(Object.values(r)[0])));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = body?.rows;

    if (!Array.isArray(rows)) {
      return Response.json({ error: 'rows must be an array' }, { status: 400 });
    }

    if (rows.length === 0) {
      return Response.json({ error: 'rows cannot be empty' }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return Response.json({ error: `rows cannot exceed ${MAX_ROWS}` }, { status: 400 });
    }

    const transformed: TransformedEntry[] = [];
    const issues: RowIssue[] = [];
    const businessKeySet = new Set<string>();

    rows.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        issues.push({ row: index + 2, message: 'Row must be an object' });
        return;
      }

      const { row, issues: rowIssues } = transformRow(raw as RawRow, index + 2);
      if (rowIssues.length > 0) {
        issues.push(...rowIssues);
        return;
      }
      if (!row) return;

      const businessKey = `${row.OrderID}::${row.ProductID}`;
      if (businessKeySet.has(businessKey)) {
        issues.push({ row: index + 2, message: `Duplicate row in upload for ${row.OrderID} + ${row.ProductID}` });
        return;
      }
      businessKeySet.add(businessKey);
      transformed.push({ sourceRow: index + 2, row });
    });

    if (issues.length > 0) {
      return Response.json(
        { inserted: 0, failed: rows.length, total: rows.length, errors: issues },
        { status: 400 },
      );
    }

    const customerIds = [...new Set(transformed.map((entry) => entry.row.CustomerID))];
    const productIds = [...new Set(transformed.map((entry) => entry.row.ProductID))];
    const shipModeIds = [
      ...new Set(transformed.map((entry) => entry.row.ShipModeID).filter((v): v is number => v !== null)),
    ];
    const salesPeopleIds = [
      ...new Set(transformed.map((entry) => entry.row.RetailSalesPeopleID).filter((v): v is number => v !== null)),
    ];
    const postalCodes = [
      ...new Set(transformed.map((entry) => entry.row.PostalCode).filter((v): v is string => v !== null)),
    ];

    const [validCustomers, validProducts, validShipModes, validSalesPeople, validPostalCodes] = await Promise.all([
      fetchValidSet(
        `SELECT CustomerID
         FROM dim_customer
         WHERE CustomerID IN (${customerIds.map(() => '?').join(',')})`,
        customerIds,
      ),
      fetchValidSet(
        `SELECT ProductID
         FROM dim_product
         WHERE ProductID IN (${productIds.map(() => '?').join(',')})`,
        productIds,
      ),
      shipModeIds.length > 0
        ? fetchValidSet(
          `SELECT ShipModeID
           FROM dim_shipmode
           WHERE ShipModeID IN (${shipModeIds.map(() => '?').join(',')})`,
          shipModeIds,
        )
        : Promise.resolve(new Set<string>()),
      salesPeopleIds.length > 0
        ? fetchValidSet(
          `SELECT RetailSalesPeopleID
           FROM dim_retailsalespeople
           WHERE RetailSalesPeopleID IN (${salesPeopleIds.map(() => '?').join(',')})`,
          salesPeopleIds,
        )
        : Promise.resolve(new Set<string>()),
      postalCodes.length > 0
        ? fetchValidSet(
          `SELECT PostalCode
           FROM dim_location
           WHERE PostalCode IN (${postalCodes.map(() => '?').join(',')})`,
          postalCodes,
        )
        : Promise.resolve(new Set<string>()),
    ]);

    transformed.forEach((entry) => {
      const { row, sourceRow } = entry;
      if (!validCustomers.has(row.CustomerID)) {
        issues.push({ row: sourceRow, message: `CustomerID does not exist: ${row.CustomerID}` });
      }
      if (!validProducts.has(row.ProductID)) {
        issues.push({ row: sourceRow, message: `ProductID does not exist: ${row.ProductID}` });
      }
      if (row.ShipModeID !== null && !validShipModes.has(String(row.ShipModeID))) {
        issues.push({ row: sourceRow, message: `ShipModeID does not exist: ${row.ShipModeID}` });
      }
      if (row.RetailSalesPeopleID !== null && !validSalesPeople.has(String(row.RetailSalesPeopleID))) {
        issues.push({
          row: sourceRow,
          message: `RetailSalesPeopleID does not exist: ${row.RetailSalesPeopleID}`,
        });
      }
      if (row.PostalCode !== null && !validPostalCodes.has(row.PostalCode)) {
        issues.push({ row: sourceRow, message: `PostalCode does not exist: ${row.PostalCode}` });
      }
    });

    if (issues.length > 0) {
      return Response.json(
        { inserted: 0, failed: rows.length, total: rows.length, errors: issues },
        { status: 400 },
      );
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const sql = `INSERT INTO fact_retailorder
        (OrderID, OrderDate, ShipDate, ShipModeID, CustomerID, PostalCode,
         RetailSalesPeopleID, ProductID, Returned, ShipStatus, Sales, Quantity, Profit, Cost, Days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      let inserted = 0;
      for (const entry of transformed) {
        const row = entry.row;
        await conn.execute<ResultSetHeader>(sql, [
          row.OrderID,
          row.OrderDate,
          row.ShipDate,
          row.ShipModeID,
          row.CustomerID,
          row.PostalCode,
          row.RetailSalesPeopleID,
          row.ProductID,
          row.Returned,
          row.ShipStatus,
          row.Sales,
          row.Quantity,
          row.Profit,
          row.Cost,
          row.Days,
        ]);
        inserted += 1;
      }

      await conn.commit();

      return Response.json({
        inserted,
        failed: 0,
        total: rows.length,
        errors: [],
      }, { status: 201 });
    } catch (err) {
      await conn.rollback();
      const mysqlErr = err as { message?: string; code?: string };
      return Response.json({
        inserted: 0,
        failed: rows.length,
        total: rows.length,
        errors: [{ row: 0, message: mysqlErr.message ?? 'Failed to load rows' }],
        code: mysqlErr.code,
      }, { status: 400 });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[POST /api/orders/bulk]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
