'use client';

import type { ShipModeStatsPoint } from '../../dashboard/analytics-api';
import { shipModeColor } from './shipModeColors';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ShipModeBubbleChart({ stats }: { stats: ShipModeStatsPoint[] }) {
  const points = stats.filter((s) => s.orders > 0);
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 44;
  const W = 520;
  const H = 300;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (points.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-headline font-bold text-on-surface">Avg cost vs avg delivery days</h2>
          <span className="text-xs text-primary">Live</span>
        </div>
        <p className="text-xs text-on-surface-variant mb-4">
          Bubbles show ship modes with at least one order. Modes with no orders are omitted here.
        </p>
        <div className="h-64 flex items-center justify-center text-xs text-on-surface-variant">No modes with orders to plot.</div>
      </div>
    );
  }

  const xMax = Math.max(...points.map((p) => p.avgCost), 1e-6);
  const yMax = Math.max(...points.map((p) => p.avgDays), 1e-6);
  const rMax = Math.max(...points.map((p) => p.orders), 1);

  const sx = (x: number) => padL + (x / xMax) * plotW;
  const sy = (y: number) => padT + plotH - (y / yMax) * plotH;
  const sr = (orders: number) => 6 + Math.sqrt(orders / rMax) * 28;

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + plotH - t * plotH);
  const gridXs = [0, 0.25, 0.5, 0.75, 1].map((t) => padL + t * plotW);

  return (
    <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-headline font-bold text-on-surface">Avg cost vs avg delivery days</h2>
        <span className="text-xs text-primary">Live</span>
      </div>
      <p className="text-xs text-on-surface-variant mb-3">
        Bubble size = number of orders; color = ship mode. Modes with no orders are omitted from this chart.
      </p>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[640px] h-auto min-h-[220px]" role="img" aria-label="Bubble chart of average cost versus average delivery days by ship mode">
          {gridYs.map((gy) => (
            <line key={gy} x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke="rgba(196,198,204,0.25)" strokeWidth="1" />
          ))}
          {gridXs.map((gx) => (
            <line key={gx} x1={gx} y1={padT} x2={gx} y2={padT + plotH} stroke="rgba(196,198,204,0.25)" strokeWidth="1" />
          ))}
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="currentColor" className="text-on-surface-variant" strokeWidth="1" />
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" className="text-on-surface-variant" strokeWidth="1" />
          <text x={padL + plotW / 2} y={H - 8} textAnchor="middle" className="fill-on-surface-variant text-[10px]">
            Avg cost
          </text>
          <text x={12} y={padT + plotH / 2} textAnchor="middle" className="fill-on-surface-variant text-[10px]" transform={`rotate(-90 12 ${padT + plotH / 2})`}>
            Avg delivery (days)
          </text>
          {points.map((p) => {
            const cx = sx(p.avgCost);
            const cy = sy(p.avgDays);
            const r = sr(p.orders);
            const title = `${p.shipMode}\nOrders: ${p.orders}\nAvg cost: ${money.format(p.avgCost)}\nAvg days: ${p.avgDays.toFixed(2)}\nAvg price: ${money.format(p.avgPrice)}\nReturn rate: ${p.returnRate.toFixed(2)}%`;
            return (
              <circle
                key={p.shipModeId}
                cx={cx}
                cy={cy}
                r={r}
                fill={shipModeColor(p.shipModeId)}
                fillOpacity={0.72}
                stroke="rgba(16,27,48,0.35)"
                strokeWidth="1"
              >
                <title>{title}</title>
              </circle>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-on-surface">
        {stats.map((p) => (
          <span key={p.shipModeId} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: shipModeColor(p.shipModeId) }} />
            <span className="text-on-surface-variant">{p.shipMode}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
