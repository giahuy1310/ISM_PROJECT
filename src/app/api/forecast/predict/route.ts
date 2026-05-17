import type { ForecastShipmentInput } from '@/lib/forecast/types';
import { mockPredictResponse } from '@/lib/forecast/mock';
import { runDelayForecastPython } from '@/lib/forecast/predict';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function requiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

type ParseResult = {
  input: ForecastShipmentInput | null;
  missingOrInvalid: string[];
};

function parseShipmentInput(value: unknown): ParseResult {
  if (!isObject(value)) return { input: null, missingOrInvalid: ['shipment'] };

  const missingOrInvalid: string[] = [];
  const orderDate = requiredString(value.orderDate);
  const shipMode = requiredString(value.shipMode);
  const postalCodeRaw = value.postalCode;
  const postalCode =
    typeof postalCodeRaw === 'number' ? String(postalCodeRaw) : requiredString(postalCodeRaw);
  const productID = requiredString(value.productID);
  const segment = requiredString(value.segment);
  const region = requiredString(value.region);

  const shipModeID = requiredNumber(value.shipModeID);
  const retailSalesPeopleID = requiredNumber(value.retailSalesPeopleID);
  const sales = requiredNumber(value.sales);
  const quantity = requiredNumber(value.quantity);
  const profit = requiredNumber(value.profit);
  const cusSegmentID = requiredNumber(value.cusSegmentID);
  const subCategoryID = requiredNumber(value.subCategoryID);
  const categoryID = requiredNumber(value.categoryID);
  const longitude = requiredNumber(value.longitude);
  const latitude = requiredNumber(value.latitude);

  if (!orderDate) missingOrInvalid.push('orderDate');
  if (!shipMode) missingOrInvalid.push('shipMode');
  if (!shipModeID && shipModeID !== 0) missingOrInvalid.push('shipModeID');
  if (!postalCode) missingOrInvalid.push('postalCode');
  if (!retailSalesPeopleID && retailSalesPeopleID !== 0) missingOrInvalid.push('retailSalesPeopleID');
  if (!productID) missingOrInvalid.push('productID');
  if (!Number.isFinite(sales ?? Number.NaN)) missingOrInvalid.push('sales');
  if (!Number.isFinite(quantity ?? Number.NaN)) missingOrInvalid.push('quantity');
  if (!Number.isFinite(profit ?? Number.NaN)) missingOrInvalid.push('profit');
  if (!cusSegmentID && cusSegmentID !== 0) missingOrInvalid.push('cusSegmentID');
  if (!segment) missingOrInvalid.push('segment');
  if (!subCategoryID && subCategoryID !== 0) missingOrInvalid.push('subCategoryID');
  if (!categoryID && categoryID !== 0) missingOrInvalid.push('categoryID');
  if (!region) missingOrInvalid.push('region');
  if (!Number.isFinite(longitude ?? Number.NaN)) missingOrInvalid.push('longitude');
  if (!Number.isFinite(latitude ?? Number.NaN)) missingOrInvalid.push('latitude');

  if (missingOrInvalid.length > 0) return { input: null, missingOrInvalid };

  return {
    input: {
      orderDate: orderDate!,
      shipMode: shipMode!,
      shipModeID: shipModeID!,
      postalCode: postalCode!,
      retailSalesPeopleID: retailSalesPeopleID!,
      productID: productID!,
      sales: sales!,
      quantity: quantity!,
      profit: profit!,
      cusSegmentID: cusSegmentID!,
      segment: segment!,
      subCategoryID: subCategoryID!,
      categoryID: categoryID!,
      region: region!,
      longitude: longitude!,
      latitude: latitude!,
    },
    missingOrInvalid: [],
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    if (!isObject(body) || !Array.isArray(body.shipments) || body.shipments.length === 0) {
      return Response.json(
        { error: 'Invalid request body. Expected { shipments: [...] } with at least one shipment.' },
        { status: 400 },
      );
    }

    const parsed = body.shipments.map(parseShipmentInput);
    const firstInvalid = parsed.findIndex((r) => r.input === null);
    if (firstInvalid >= 0) {
      const missing = parsed[firstInvalid].missingOrInvalid.join(', ');
      return Response.json({
        error: `Invalid shipment at index ${firstInvalid}. Missing/invalid fields: ${missing}`,
      }, { status: 400 });
    }

    const valid = parsed.map((r) => r.input as ForecastShipmentInput);
    if (process.env.FORECAST_USE_MOCK === 'true') {
      return Response.json(mockPredictResponse(valid));
    }

    try {
      const result = await runDelayForecastPython({ shipments: valid });
      return Response.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Forecast inference failed';
      if (process.env.FORECAST_FALLBACK_MOCK === 'true') {
        console.warn(
          '[POST /api/forecast/predict] PYTHON inference failed; FORECAST_FALLBACK_MOCK — using mock.',
          message,
        );
        return Response.json(mockPredictResponse(valid));
      }
      console.error('[POST /api/forecast/predict]', err);
      return Response.json({ error: message }, { status: 503 });
    }
  } catch (error) {
    console.error('[POST /api/forecast/predict]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
