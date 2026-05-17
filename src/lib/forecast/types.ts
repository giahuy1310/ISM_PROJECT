export type DelayRiskLabel = 'Low' | 'Medium' | 'High';

/**
 * Delay model request contract.
 * Calendar features (month/dayOfWeek/dayOfMonth/isWeekend) are derived from orderDate in Python.
 */
export type ForecastShipmentInput = {
  orderDate: string;
  shipMode: string;
  shipModeID: number;
  postalCode: string;
  retailSalesPeopleID: number;
  productID: string;
  sales: number;
  quantity: number;
  profit: number;
  cusSegmentID: number;
  segment: string;
  subCategoryID: number;
  categoryID: number;
  region: string;
  longitude: number;
  latitude: number;
};

export type ForecastPredictRequest = {
  shipments: ForecastShipmentInput[];
};

export type ForecastPrediction = {
  delayRiskScore: number;
  delayRiskLabel: DelayRiskLabel;
  explanation: string;
};

export type ForecastPredictResponse = {
  modelVersion: string;
  generatedAt: string;
  predictions: ForecastPrediction[];
};
