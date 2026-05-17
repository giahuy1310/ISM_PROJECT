'use client';

import { useCallback, useState } from 'react';
import type { ShipModeStatsPoint } from '../../dashboard/analytics-api';
import { AddShipModeDialog } from './AddShipModeDialog';
import { ShipModeBarChart } from './ShipModeBarChart';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const moneyDetail = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function ShipmentsView({ initialStats }: { initialStats: ShipModeStatsPoint[] }) {
  const [stats, setStats] = useState(initialStats);
  const [dialogOpen, setDialogOpen] = useState(false);

  const formatOrders = (v: number) => v.toLocaleString();

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/shipmode-stats');
      if (res.ok) {
        const data = (await res.json()) as ShipModeStatsPoint[];
        setStats(Array.isArray(data) ? data : []);
      }
    } catch {
      // keep previous stats
    }
  }, []);

  const handleAdded = useCallback(() => {
    setDialogOpen(false);
    void refetch();
  }, [refetch]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-black text-on-primary-fixed">Shipments</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Metrics by ship mode: delivery time, volume, returns, pricing, and cost vs lead time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-full px-5 h-10 text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Add ship mode
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShipModeBarChart
          title="Average delivery time (days)"
          stats={stats}
          valueOf={(s) => s.avgDays}
          formatValue={(v) => `${v.toFixed(1)}d`}
          tooltip={(s) => `${s.shipMode}: ${s.avgDays.toFixed(2)}d avg · ${s.orders} orders`}
        />
        <ShipModeBarChart
          title="Total orders"
          stats={stats}
          valueOf={(s) => s.orders}
          formatValue={formatOrders}
          tooltip={(s) => `${s.shipMode}: ${s.orders.toLocaleString()} orders`}
        />
        <ShipModeBarChart
          title="Return rate"
          stats={stats}
          valueOf={(s) => s.returnRate}
          formatValue={(v) => `${v.toFixed(1)}%`}
          tooltip={(s) => `${s.shipMode}: ${s.returnRate.toFixed(2)}% returned · ${s.orders} orders`}
        />
        <ShipModeBarChart
          title="Average price (avg sales per line)"
          stats={stats}
          valueOf={(s) => s.avgPrice}
          formatValue={(v) => money.format(v)}
          tooltip={(s) => `${s.shipMode}: ${moneyDetail.format(s.avgPrice)} avg sales · ${s.orders} orders`}
        />
      </div>

      <AddShipModeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdded={handleAdded} />
    </section>
  );
}
