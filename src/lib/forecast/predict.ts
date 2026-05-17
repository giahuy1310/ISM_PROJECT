import { spawn } from 'node:child_process';
import path from 'node:path';

import type { ForecastPredictRequest, ForecastPredictResponse } from './types';

function isForecastError(obj: unknown): obj is { error: string } {
  return (
    typeof obj === 'object'
    && obj !== null
    && 'error' in obj
    && typeof (obj as { error: unknown }).error === 'string'
  );
}

function isValidResponse(obj: unknown): obj is ForecastPredictResponse {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Partial<ForecastPredictResponse>;
  if (typeof r.modelVersion !== 'string' || typeof r.generatedAt !== 'string') return false;
  if (!Array.isArray(r.predictions)) return false;
  for (const p of r.predictions) {
    if (!p || typeof p !== 'object') return false;
    if (typeof (p as { delayRiskScore?: unknown }).delayRiskScore !== 'number') return false;
    if (typeof (p as { delayRiskLabel?: unknown }).delayRiskLabel !== 'string') return false;
    if (typeof (p as { explanation?: unknown }).explanation !== 'string') return false;
  }
  return true;
}

/** Runs `scripts/forecast_predict.py` with JSON on stdin; returns parsed API response. */
export async function runDelayForecastPython(body: ForecastPredictRequest): Promise<ForecastPredictResponse> {
  const root = path.join(/* turbopackIgnore: true */ process.cwd());
  const python = process.env.FORECAST_PYTHON ?? 'python3';
  const script = path.join(root, 'scripts', 'forecast_predict.py');
  const classifierPath =
    process.env.FORECAST_CLASSIFIER_PATH ?? path.join(root, 'models', 'forecast', 'delay_classifier.pkl');
  const metadataPath =
    process.env.FORECAST_METADATA_PATH ?? path.join(root, 'models', 'forecast', 'forecast_metadata.pkl');

  const args = [script, `--classifier=${classifierPath}`, `--metadata=${metadataPath}`];

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(python, args, {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end(JSON.stringify(body));
    let out = '';
    let errOut = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c: string) => {
      out += c;
    });
    child.stderr.on('data', (c: string) => {
      errOut += c;
    });
    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', (code, signal) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(out) as unknown;
      } catch {
        if (code === 0) {
          reject(new Error('Forecast script returned non-JSON output'));
          return;
        }
        const signalPart = signal ? ` signal=${signal}` : '';
        const errPart = errOut.trim() ? ` ${errOut.trim()}` : '';
        reject(new Error(`Forecast script failed (code=${code}${signalPart}).${errPart}`.trim()));
        return;
      }
      if (isForecastError(parsed)) {
        reject(new Error(parsed.error));
        return;
      }
      if (code !== 0) {
        const signalPart = signal ? ` signal=${signal}` : '';
        const errPart = errOut.trim() ? ` ${errOut.trim()}` : '';
        reject(new Error(`Forecast script exited with code=${code}${signalPart}.${errPart}`.trim()));
        return;
      }
      if (!isValidResponse(parsed)) {
        reject(new Error('Forecast script returned an invalid response shape'));
        return;
      }
      resolve(out);
    });
  });

  return JSON.parse(stdout) as ForecastPredictResponse;
}
