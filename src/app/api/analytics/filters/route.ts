import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [countries] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dl.Country FROM dim_location dl ORDER BY dl.Country',
    );
    const [regions] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dl.Region FROM dim_location dl ORDER BY dl.Region',
    );
    const [states] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dl.State FROM dim_location dl ORDER BY dl.State',
    );
    const [cities] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dl.City FROM dim_location dl WHERE dl.City IS NOT NULL ORDER BY dl.City',
    );
    const [months] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT MONTH(f.OrderDate) AS month FROM fact_retailorder f WHERE f.OrderDate IS NOT NULL ORDER BY month',
    );
    const [years] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT YEAR(f.OrderDate) AS year FROM fact_retailorder f WHERE f.OrderDate IS NOT NULL ORDER BY year',
    );
    const [segments] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dcs.Segment FROM dim_customersegment dcs ORDER BY dcs.Segment',
    );
    const [categories] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dcat.Category FROM dim_category dcat ORDER BY dcat.Category',
    );
    const [subCategories] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dsc.SubCategory FROM dim_subcategory dsc ORDER BY dsc.SubCategory',
    );
    const [shipModes] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT dsm.ShipMode FROM dim_shipmode dsm ORDER BY dsm.ShipMode',
    );
    const [dateRange] = await pool.execute<RowDataPacket[]>(
      'SELECT MIN(f.OrderDate) AS earliestDate, MAX(f.OrderDate) AS latestDate FROM fact_retailorder f',
    );
    const [sellers] = await pool.execute<RowDataPacket[]>(
      'SELECT RetailSalesPeopleID, RetailSalesPeople FROM dim_retailsalespeople ORDER BY RetailSalesPeople',
    );

    return Response.json({
      countries: (countries as RowDataPacket[]).map((r) => r.Country),
      regions: (regions as RowDataPacket[]).map((r) => r.Region),
      states: (states as RowDataPacket[]).map((r) => r.State),
      cities: (cities as RowDataPacket[]).map((r) => r.City),
      months: (months as RowDataPacket[]).map((r) => Number(r.month)).filter((value) => Number.isFinite(value)),
      years: (years as RowDataPacket[]).map((r) => Number(r.year)).filter((value) => Number.isFinite(value)),
      segments: (segments as RowDataPacket[]).map((r) => r.Segment),
      categories: (categories as RowDataPacket[]).map((r) => r.Category),
      subCategories: (subCategories as RowDataPacket[]).map((r) => r.SubCategory),
      shipModes: (shipModes as RowDataPacket[]).map((r) => r.ShipMode),
      sellers: (sellers as RowDataPacket[]).map((r) => ({
        retailSalesPeopleId: Number(r.RetailSalesPeopleID),
        name: String(r.RetailSalesPeople),
      })),
      dateRange: {
        earliestDate: (dateRange as RowDataPacket[])[0]?.earliestDate ?? null,
        latestDate: (dateRange as RowDataPacket[])[0]?.latestDate ?? null,
      },
    });
  } catch (err) {
    console.error('[GET /api/analytics/filters]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
