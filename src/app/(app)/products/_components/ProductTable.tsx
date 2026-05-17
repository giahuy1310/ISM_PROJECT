'use client';

import { useMemo, useState } from 'react';
import { type ProductTablePoint } from '../../dashboard/analytics-api';

type SortDirection = 'asc' | 'desc';
type SortKey =
  | 'productId'
  | 'productName'
  | 'sales'
  | 'profit'
  | 'returnRate'
  | 'avgDeliveryDays';

const columns: Array<{ key: SortKey; label: string; numeric: boolean }> = [
  { key: 'productId', label: 'Product ID', numeric: false },
  { key: 'productName', label: 'Product Name', numeric: false },
  { key: 'sales', label: 'Sales', numeric: true },
  { key: 'profit', label: 'Profit', numeric: true },
  { key: 'returnRate', label: 'Return Rate', numeric: true },
  { key: 'avgDeliveryDays', label: 'Avg Delivery Dates', numeric: true },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function ProductTable({ rows }: { rows: ProductTablePoint[] }) {
  const [productIdQuery, setProductIdQuery] = useState('');
  const [productNameQuery, setProductNameQuery] = useState('');
  const [subCategoryQuery, setSubCategoryQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('productName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const visibleRows = useMemo(() => {
    const idQ = productIdQuery.trim().toLowerCase();
    const nameQ = productNameQuery.trim().toLowerCase();
    const subQ = subCategoryQuery.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const matchId = !idQ || row.productId.toLowerCase().includes(idQ);
      const matchName = !nameQ || row.productName.toLowerCase().includes(nameQ);
      const matchSub = !subQ || row.subCategory.toLowerCase().includes(subQ);
      return matchId && matchName && matchSub;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue)) * direction;
    });

    return sorted;
  }, [productIdQuery, productNameQuery, subCategoryQuery, rows, sortDirection, sortKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-low px-4 py-3 rounded-lg shadow-[inset_0_0_0_1px_rgba(196,198,204,0.12)]">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="bg-surface-container-lowest rounded-full px-4 py-2 flex items-center gap-2 focus-within:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">tag</span>
            <input
              type="text"
              value={productIdQuery}
              onChange={(event) => setProductIdQuery(event.target.value)}
              placeholder="Search Product ID..."
              className="bg-transparent outline-none text-sm text-on-surface w-full placeholder-on-surface-variant"
            />
          </div>
          <div className="bg-surface-container-lowest rounded-full px-4 py-2 flex items-center gap-2 focus-within:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <input
              type="text"
              value={productNameQuery}
              onChange={(event) => setProductNameQuery(event.target.value)}
              placeholder="Search Product Name..."
              className="bg-transparent outline-none text-sm text-on-surface w-full placeholder-on-surface-variant"
            />
          </div>
          <div className="bg-surface-container-lowest rounded-full px-4 py-2 flex items-center gap-2 focus-within:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">category</span>
            <input
              type="text"
              value={subCategoryQuery}
              onChange={(event) => setSubCategoryQuery(event.target.value)}
              placeholder="Search Sub Category..."
              className="bg-transparent outline-none text-sm text-on-surface w-full placeholder-on-surface-variant"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface-container-lowest shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-container-low">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 text-left font-semibold text-on-surface ${column.numeric ? 'text-right' : ''}`}>
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className={`w-full inline-flex items-center gap-1 ${column.numeric ? 'justify-end' : 'justify-start'}`}
                  >
                    <span>{column.label}</span>
                    <span className="text-xs text-on-surface-variant">
                      {sortKey === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-on-surface-variant">
                  No products match your search.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.productId} className="border-t border-surface-container-high/50">
                  <td className="px-4 py-3 text-on-surface">{row.productId}</td>
                  <td className="px-4 py-3 text-on-surface">{row.productName}</td>
                  <td className="px-4 py-3 text-right text-on-surface">{money.format(row.sales)}</td>
                  <td className="px-4 py-3 text-right text-on-surface">{money.format(row.profit)}</td>
                  <td className="px-4 py-3 text-right text-on-surface">{row.returnRate.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-on-surface">{row.avgDeliveryDays.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
