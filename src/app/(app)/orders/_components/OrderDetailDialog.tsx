'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { bouncy, useMotionPreference } from '../../_components/motion-presets';

type OrderDetail = {
  RetailOrderID: number;
  OrderID: string;
  OrderDate: string;
  ShipDate: string | null;
  ShipStatus: string | null;
  Returned: string | null;
  Sales: number | null;
  Quantity: number | null;
  Profit: number | null;
  Cost: number | null;
  Days: number | null;
  CustomerID: string;
  CustomerName: string;
  Segment: string;
  ProductID: string;
  ProductName: string;
  SubCategory: string;
  Category: string;
  ShipMode: string;
  City: string;
  State: string;
  Region: string;
  Country: string;
  PostalCode: string;
  RetailSalesPeople: string;
};

export function OrderDetailDialog({
  retailOrderId,
  open,
  onClose,
}: {
  retailOrderId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const { reducedMotion } = useMotionPreference();
  const loading = open && retailOrderId !== null && !data && !error;

  useEffect(() => {
    if (!open || retailOrderId === null) return;

    const controller = new AbortController();

    fetch(`/api/orders/${retailOrderId}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? 'Failed to load order details');
        }
        setData(json as OrderDetail);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load order details');
      });

    return () => controller.abort();
  }, [open, retailOrderId]);

  const detailRows: Array<[string, string | number | null | undefined]> = data
    ? [
        ['RetailOrderID', data.RetailOrderID],
        ['OrderID', data.OrderID],
        ['OrderDate', data.OrderDate],
        ['ShipDate', data.ShipDate],
        ['ShipStatus', data.ShipStatus],
        ['Returned', data.Returned],
        ['CustomerID', data.CustomerID],
        ['CustomerName', data.CustomerName],
        ['Segment', data.Segment],
        ['ProductID', data.ProductID],
        ['ProductName', data.ProductName],
        ['SubCategory', data.SubCategory],
        ['Category', data.Category],
        ['ShipMode', data.ShipMode],
        ['PostalCode', data.PostalCode],
        ['City', data.City],
        ['State', data.State],
        ['Region', data.Region],
        ['Country', data.Country],
        ['RetailSalesPeople', data.RetailSalesPeople],
        ['Sales', data.Sales],
        ['Quantity', data.Quantity],
        ['Profit', data.Profit],
        ['Cost', data.Cost],
        ['Days', data.Days],
      ]
    : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0.08 } : { duration: 0.16 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl"
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={reducedMotion ? { duration: 0.08 } : bouncy}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[rgba(196,198,204,0.2)] flex items-center justify-between">
              <h2 className="text-lg font-headline font-bold text-on-surface">
                Order Details
              </h2>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-surface-container-high transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)]">
              {loading && <p className="text-sm text-on-surface-variant">Loading order details...</p>}
              {error && <p className="text-sm text-red-500">{error}</p>}
              {!loading && !error && !data && <p className="text-sm text-on-surface-variant">No details found.</p>}

              {!loading && !error && data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-[rgba(196,198,204,0.2)] bg-surface-container-low p-3"
                    >
                      <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
                      <p className="text-sm text-on-surface mt-1 break-all">
                        {value === null || value === '' || value === undefined ? '—' : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
