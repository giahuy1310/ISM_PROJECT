import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [[shipModes], [salesPeople]] = await Promise.all([
      pool.execute<RowDataPacket[]>(
        'SELECT ShipModeID, ShipMode FROM dim_shipmode ORDER BY ShipMode',
      ),
      pool.execute<RowDataPacket[]>(
        'SELECT RetailSalesPeopleID, RetailSalesPeople FROM dim_retailsalespeople ORDER BY RetailSalesPeople',
      ),
    ]);

    return Response.json({
      shipModes: shipModes as RowDataPacket[],
      salesPeople: salesPeople as RowDataPacket[],
    });
  } catch (err) {
    console.error('[GET /api/orders/lookup]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
