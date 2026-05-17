import type {
  DelayRiskLabel,
  ForecastPredictResponse,
  ForecastPrediction,
  ForecastShipmentInput,
} from './types';

function classifyRisk(score: number): DelayRiskLabel {
  if (score >= 0.6) return 'High';
  if (score >= 0.3) return 'Medium';
  return 'Low';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mockPredictShipment(input: ForecastShipmentInput): ForecastPrediction {
  const mode = input.shipMode.toLowerCase();
  let modeBump = 0;
  if (mode.includes('standard')) modeBump += 0.06;
  else if (mode.includes('second')) modeBump += 0.03;
  if (mode.includes('same')) modeBump -= 0.03;

  const qtyAdj = Math.min(input.quantity * 0.025, 0.12);
  const salesAdj = Math.min(input.sales / 8000, 0.1);
  const profitAdj = input.profit < 0 ? 0.07 : 0;

  const orderDt = new Date(input.orderDate);
  const hasValidOrderDate = Number.isNaN(orderDt.getTime()) === false;
  const calendarJitter = hasValidOrderDate ? (((orderDt.getMonth() + 1 + orderDt.getDay()) % 13) / 130) : 0;

  const delayRiskScore = round2(
    clamp(0.22 + qtyAdj + salesAdj + profitAdj + modeBump + calendarJitter, 0, 1),
  );
  const delayRiskLabel = classifyRisk(delayRiskScore);

  return {
    delayRiskScore,
    delayRiskLabel,
    explanation:
      'Mock calibrated risk (development only): ship mode, quantity, sales, and international heuristic. Matches 0.3 / 0.6 label bands.',
  };
}

export function mockPredictResponse(shipments: ForecastShipmentInput[]): ForecastPredictResponse {
  return {
    modelVersion: 'mock-delay-v1',
    generatedAt: new Date().toISOString(),
    predictions: shipments.map(mockPredictShipment),
  };
}
