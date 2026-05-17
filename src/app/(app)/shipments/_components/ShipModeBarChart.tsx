'use client';

import type { ShipModeStatsPoint } from '../../dashboard/analytics-api';
import { shipModeColor } from './shipModeColors';

function barHeight(value: number, maxValue: number): number {
  if (maxValue <= 0) return 20;
  return 20 + (value / maxValue) * 70;
}

export function ShipModeBarChart({
  title,
  stats,
  valueOf,
  formatValue,
  tooltip,
}: {
  title: string;
  stats: ShipModeStatsPoint[];
  valueOf: (s: ShipModeStatsPoint) => number;
  formatValue: (v: number) => string;
  tooltip?: (s: ShipModeStatsPoint) => string;
}) {
  const values = stats.map(valueOf);
  const maxValue = Math.max(...values, 0);
  const topAxisFormatted = formatValue(maxValue);
  const handleBarHover = (
    event: React.MouseEvent<HTMLDivElement>,
    item: ShipModeStatsPoint,
    value: number,
    heightPercent: number,
  ) => {
    const barRect = event.currentTarget.getBoundingClientRect();
    const chartRect = event.currentTarget.parentElement?.getBoundingClientRect();
    const estimatedTooltipTop = barRect.top - 48;
    const clipTop = chartRect ? estimatedTooltipTop < chartRect.top : null;
    const chartOverflowX = chartRect
      ? window.getComputedStyle(event.currentTarget.parentElement as Element).overflowX
      : null;
    const chartOverflowY = chartRect
      ? window.getComputedStyle(event.currentTarget.parentElement as Element).overflowY
      : null;
  };

  if (stats.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
        <h2 className="text-sm font-headline font-bold text-on-surface mb-4">{title}</h2>
        <div className="h-48 flex items-center justify-center text-xs text-on-surface-variant">No data</div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-headline font-bold text-on-surface">{title}</h2>
        <span className="text-xs text-primary">Live</span>
      </div>
      <div className="h-56 relative flex items-end justify-between px-2 pb-8 overflow-x-auto">
        <div className="absolute left-0 top-0 bottom-8 w-11 flex flex-col justify-between text-[10px] text-on-surface-variant font-label text-right pr-1 shrink-0">
          <span>{topAxisFormatted}</span>
          <span>{formatValue(maxValue * 0.75)}</span>
          <span>{formatValue(maxValue * 0.5)}</span>
          <span>{formatValue(maxValue * 0.25)}</span>
          <span>{formatValue(0)}</span>
        </div>
        <div className="relative z-10 flex justify-around items-end h-full min-w-full ml-10 gap-1">
          {stats.map((item) => {
            const v = valueOf(item);
            const h = barHeight(v, maxValue);
            const tip = tooltip ? tooltip(item) : `${item.shipMode}: ${formatValue(v)}`;
            const placeBelow = h >= 75;
            return (
              <div
                key={item.shipModeId}
                className="w-10 sm:w-12 rounded-t-sm relative group shrink-0"
                onMouseEnter={(event) => handleBarHover(event, item, v, h)}
                style={{
                  height: `${h}%`,
                  backgroundColor: shipModeColor(item.shipModeId),
                }}
              >
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-label font-bold text-on-surface-variant text-center max-w-[4.5rem] truncate" title={item.shipMode}>
                  {item.shipMode}
                </div>
                <div
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#101b30] text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg z-20 ${
                    placeBelow ? 'top-full mt-1' : '-top-12'
                  }`}
                >
                  {tip}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
