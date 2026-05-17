'use client';

import { useState } from 'react';
import { ManualOrderForm } from './ManualOrderForm';
import { ExcelUpload } from './ExcelUpload';

type AddTab = 'manual' | 'excel';

export function AddOrderView() {
  const [tab, setTab] = useState<AddTab>('manual');

  return (
    <div className="space-y-6">
      {/* Sub-tab toggle */}
      <div className="inline-flex items-center gap-1 bg-surface-container-low rounded-full p-1 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.2)]">
        <TabButton active={tab === 'manual'} icon="edit_note" label="Manual Entry" onClick={() => setTab('manual')} />
        <TabButton active={tab === 'excel'} icon="upload_file" label="Excel Upload" onClick={() => setTab('excel')} />
      </div>

      {tab === 'manual' ? <ManualOrderForm /> : <ExcelUpload />}
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 h-8 text-xs font-body font-semibold transition-colors ${
        active
          ? 'bg-primary-container text-on-primary-container shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );
}
