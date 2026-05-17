'use client';

import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { bouncy, useMotionPreference } from '../../_components/motion-presets';

const COLUMNS = [
  'OrderID', 'OrderDate', 'ShipDate', 'ShipModeID', 'CustomerID',
  'PostalCode', 'RetailSalesPeopleID', 'ProductID', 'Returned',
  'ShipStatus', 'Sales', 'Quantity', 'Profit', 'Cost', 'Days',
] as const;

type RowData = Record<string, string | number | null>;

type UploadStatus = 'idle' | 'parsed' | 'submitting' | 'done' | 'error';

interface BulkError {
  row: number;
  message: string;
}

interface BulkUploadResult {
  inserted: number;
  failed: number;
  total: number;
  errors: BulkError[];
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // Column map (0-indexed): A=OrderID B=OrderDate C=ShipDate … K=Sales L=Quantity M=Profit N=Cost O=Days
  // Profit and Days are formula-driven; pass null so aoa_to_sheet creates the cell refs first
  const ws = XLSX.utils.aoa_to_sheet([
    [...COLUMNS],
    ['CA-2026-001', '2026-05-01', '2026-05-04', 1, 'CG-12520', 10024, 1, 'FUR-BO-10001798', 'No', 'On-Time', 250, 2, null, 170, null],
  ]);

  // Profit (M2, c:12) = Sales - Cost
  const profitCell = XLSX.utils.encode_cell({ r: 1, c: 12 });
  ws[profitCell] = { t: 'n', f: 'IF(OR(K2="",N2=""),"",K2-N2)' };

  // Days (O2, c:14) = ShipDate - OrderDate
  const daysCell = XLSX.utils.encode_cell({ r: 1, c: 14 });
  ws[daysCell] = { t: 'n', f: 'IF(C2="","",C2-B2)' };

  // Format B and C columns as dates so Excel interprets them correctly
  if (!ws['!cols']) ws['!cols'] = COLUMNS.map(() => ({ wch: 22 }));
  if (!ws['!rows']) ws['!rows'] = [];

  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, 'order_template.xlsx');
}

export function ExcelUpload() {
  const { reducedMotion } = useMotionPreference();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState<RowData[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [fileName, setFileName] = useState('');

  function parseFile(file: File) {
    setErrors([]);
    setRows([]);
    setStatus('idle');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

        if (raw.length === 0) {
          setErrors(['The spreadsheet is empty.']);
          return;
        }

        const errs: string[] = [];
        const parsed: RowData[] = raw.map((r, i) => {
          const row: RowData = {};
          for (const col of COLUMNS) {
            const val = r[col];
            if (val instanceof Date) {
              row[col] = val.toISOString().split('T')[0];
            } else {
              row[col] = val as string | number | null;
            }
          }
          if (!row['OrderID']) errs.push(`Row ${i + 2}: OrderID is required`);
          if (!row['OrderDate']) errs.push(`Row ${i + 2}: OrderDate is required`);
          if (!row['CustomerID']) errs.push(`Row ${i + 2}: CustomerID is required`);
          if (!row['ProductID']) errs.push(`Row ${i + 2}: ProductID is required`);
          return row;
        });

        if (errs.length) {
          setErrors(errs);
          return;
        }
        setRows(parsed);
        setStatus('parsed');
      } catch {
        setErrors(['Failed to parse the file. Make sure it is a valid .xlsx file.']);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, []);

  async function handleSubmit() {
    if (!rows.length || status === 'submitting') return;
    setStatus('submitting');
    setProgress({ done: 0, total: rows.length, failed: 0 });
    setErrors([]);

    try {
      const res = await fetch('/api/orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      const data = (await res.json()) as BulkUploadResult | { error?: string };

      if (!res.ok) {
        const bulk = data as BulkUploadResult;
        if (Array.isArray(bulk.errors) && bulk.errors.length > 0) {
          setErrors(bulk.errors.slice(0, 120).map((e) => `Row ${e.row}: ${e.message}`));
          setProgress({ done: rows.length, total: rows.length, failed: bulk.failed ?? rows.length });
        } else {
          const fallback = (data as { error?: string }).error ?? 'Bulk upload failed';
          setErrors([fallback]);
          setProgress({ done: rows.length, total: rows.length, failed: rows.length });
        }
        setStatus('error');
        return;
      }

      const bulk = data as BulkUploadResult;
      if (bulk.errors.length > 0) {
        setErrors(bulk.errors.slice(0, 120).map((e) => `Row ${e.row}: ${e.message}`));
      }

      setProgress({
        done: bulk.total ?? rows.length,
        total: bulk.total ?? rows.length,
        failed: bulk.failed ?? 0,
      });
      setStatus('done');
    } catch {
      setErrors(['Network error while uploading rows.']);
      setProgress({ done: rows.length, total: rows.length, failed: rows.length });
      setStatus('error');
    }
  }

  function reset() {
    setRows([]);
    setErrors([]);
    setStatus('idle');
    setFileName('');
    setProgress({ done: 0, total: 0, failed: 0 });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-on-surface-variant">
          Upload a formatted <span className="font-mono text-xs bg-surface-container-high px-1 py-0.5 rounded">.xlsx</span> file to bulk-insert order records.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 rounded-full px-4 h-8 text-xs font-body font-semibold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Download Template
        </button>
      </div>

      {/* Drop zone */}
      {status === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.15 } : bouncy}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-[rgba(196,198,204,0.3)] hover:border-primary/50 hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-4xl text-on-surface-variant">upload_file</span>
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">Drag &amp; drop your file here</p>
            <p className="text-xs text-on-surface-variant mt-0.5">or click to browse — .xlsx files only</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
          />
        </motion.div>
      )}

      {/* Validation errors */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-4 bg-[rgba(180,0,0,0.07)] shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] space-y-1"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-red-500 text-lg">error</span>
              <p className="text-sm font-semibold text-on-surface">Validation errors — fix before re-uploading</p>
            </div>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-on-surface-variant font-mono">{e}</p>
            ))}
            <button onClick={reset} className="mt-2 text-xs text-primary underline">Upload another file</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview table */}
      {status === 'parsed' && rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.15 } : bouncy}
          className="bg-surface-container-lowest rounded-xl shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] overflow-hidden"
        >
          <div className="p-4 border-b border-[rgba(196,198,204,0.12)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-on-surface-variant">table_view</span>
              <span className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider">
                Preview — {rows.length} row{rows.length !== 1 ? 's' : ''} from <span className="font-mono normal-case">{fileName}</span>
              </span>
            </div>
            <button onClick={reset} className="text-xs text-on-surface-variant hover:text-on-surface underline">Change file</button>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgba(196,198,204,0.12)] sticky top-0 bg-surface-container-low">
                  {COLUMNS.map((c) => (
                    <th key={c} className="px-3 py-2 text-left font-label font-semibold text-on-surface-variant whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-[rgba(196,198,204,0.08)] hover:bg-surface-container-low transition-colors">
                    {COLUMNS.map((c) => (
                      <td key={c} className="px-3 py-1.5 text-on-surface font-mono whitespace-nowrap">
                        {row[c] === null || row[c] === '' ? <span className="text-on-surface-variant/40">—</span> : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && (
            <p className="px-4 py-2 text-xs text-on-surface-variant border-t border-[rgba(196,198,204,0.12)]">
              Showing first 50 of {rows.length} rows. All rows will be submitted.
            </p>
          )}
          <div className="p-4 border-t border-[rgba(196,198,204,0.12)] flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-full px-6 h-10 text-sm font-body font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              Submit {rows.length} Order{rows.length !== 1 ? 's' : ''}
            </button>
          </div>
        </motion.div>
      )}

      {/* Progress / done */}
      {(status === 'submitting' || status === 'done' || status === 'error') && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.15 } : bouncy}
          className={`rounded-xl p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] space-y-3 ${
            (status === 'done' || status === 'error') && progress.failed === 0
              ? 'bg-[rgba(0,128,64,0.08)]'
              : status === 'done' || status === 'error'
              ? 'bg-[rgba(180,0,0,0.07)]'
              : 'bg-surface-container-low'
          }`}
        >
          <div className="flex items-center gap-2">
            {status === 'submitting' ? (
              <span className="material-symbols-outlined text-xl animate-spin text-primary">progress_activity</span>
            ) : progress.failed === 0 ? (
              <span className="material-symbols-outlined text-xl text-green-500">check_circle</span>
            ) : (
              <span className="material-symbols-outlined text-xl text-red-500">error</span>
            )}
            <p className="text-sm font-semibold text-on-surface">
              {status === 'submitting'
                ? `Inserting… ${progress.done} / ${progress.total}`
                : progress.failed === 0
                ? `All ${progress.total} orders inserted successfully`
                : `Done — ${progress.done - progress.failed} succeeded, ${progress.failed} failed`}
            </p>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
            />
          </div>
          {status === 'done' && (
            <button onClick={reset} className="text-xs text-primary underline">Upload another file</button>
          )}
        </motion.div>
      )}
    </div>
  );
}
