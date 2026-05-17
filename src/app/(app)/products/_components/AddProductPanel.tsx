'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductCategoryOption } from '../../dashboard/analytics-api';

const FIELD_CLASS =
  'w-full bg-surface-container-low border border-[rgba(196,198,204,0.2)] rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors disabled:opacity-60';

type SubmitState = 'idle' | 'loading' | 'error' | 'success';

type AddProductPanelProps = Readonly<{
  categories: ProductCategoryOption[];
}>;

export function AddProductPanel({ categories }: AddProductPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [unitCP, setUnitCP] = useState('');
  const [unitSP, setUnitSP] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  const selectedCategory = useMemo(
    () => categories.find((item) => item.categoryId === categoryId) ?? null,
    [categories, categoryId],
  );

  const subCategoryOptions = selectedCategory?.subCategories ?? [];

  function resetForm(keepOpen = false) {
    setProductName('');
    setCategoryId('');
    setSubCategoryId('');
    setUnitCP('');
    setUnitSP('');
    setSubmitState('idle');
    setMessage('');
    if (!keepOpen) {
      setOpen(false);
    }
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState === 'loading') {
      return;
    }

    const trimmedProductName = productName.trim();
    if (!trimmedProductName || !categoryId || !subCategoryId) {
      setSubmitState('error');
      setMessage('Please fill Product Name, Category, and Sub Category.');
      return;
    }

    setSubmitState('loading');
    setMessage('');

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ProductName: trimmedProductName,
          SubCategoryID: Number(subCategoryId),
          UnitCP: unitCP.trim() === '' ? null : Number(unitCP),
          UnitSP: unitSP.trim() === '' ? null : Number(unitSP),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitState('error');
        setMessage(typeof payload.error === 'string' ? payload.error : 'Unable to create product.');
        return;
      }

      const createdId = typeof payload.ProductID === 'string' ? payload.ProductID : '(generated)';
      setSubmitState('success');
      setMessage(`Product created with ID ${createdId}.`);
      resetForm(true);
      setMessage(`Product created with ID ${createdId}.`);
      router.refresh();
    } catch {
      setSubmitState('error');
      setMessage('Network error while creating product.');
    }
  }

  const messageClassName = submitState === 'error' ? 'md:col-span-2 text-xs text-red-500' : 'md:col-span-2 text-xs text-emerald-600';
  const formMessage = message ? <p className={messageClassName}>{message}</p> : null;
  const collapsedMessage = !open && message ? <p className="mt-3 text-xs text-emerald-600">{message}</p> : null;

  return (
    <div className="bg-surface-container-low rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-on-surface">Add Product</h2>
          <p className="text-xs text-on-surface-variant">Product ID is generated automatically from category and sub category codes.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (open) {
              resetForm();
              return;
            }
            setOpen(true);
            setSubmitState('idle');
            setMessage('');
          }}
          className="inline-flex items-center gap-2 rounded-full px-4 h-9 text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-base">{open ? 'close' : 'add_circle'}</span>
          {open ? 'Close' : 'Add Product'}
        </button>
      </div>

      {open ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="product-name" className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Product Name
            </label>
            <input
              id="product-name"
              type="text"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              className={FIELD_CLASS}
              maxLength={100}
              autoComplete="off"
              disabled={submitState === 'loading'}
              required
            />
          </div>

          <div>
            <label htmlFor="category-id" className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Category
            </label>
            <select
              id="category-id"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setSubCategoryId('');
              }}
              className={FIELD_CLASS}
              disabled={submitState === 'loading' || categories.length === 0}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sub-category-id" className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Sub Category
            </label>
            <select
              id="sub-category-id"
              value={subCategoryId}
              onChange={(event) => setSubCategoryId(event.target.value)}
              className={FIELD_CLASS}
              disabled={submitState === 'loading' || !selectedCategory}
              required
            >
              <option value="">Select sub category</option>
              {subCategoryOptions.map((subCategory) => (
                <option key={subCategory.subCategoryId} value={subCategory.subCategoryId}>
                  {subCategory.subCategory}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="unit-cp" className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Unit CP
            </label>
            <input
              id="unit-cp"
              type="number"
              value={unitCP}
              onChange={(event) => setUnitCP(event.target.value)}
              className={FIELD_CLASS}
              step="0.01"
              min="0"
              disabled={submitState === 'loading'}
              placeholder="Optional"
            />
          </div>

          <div>
            <label htmlFor="unit-sp" className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Unit SP
            </label>
            <input
              id="unit-sp"
              type="number"
              value={unitSP}
              onChange={(event) => setUnitSP(event.target.value)}
              className={FIELD_CLASS}
              step="0.01"
              min="0"
              disabled={submitState === 'loading'}
              placeholder="Optional"
            />
          </div>

          {formMessage}

          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => resetForm()}
              className="rounded-full px-4 h-9 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
              disabled={submitState === 'loading'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitState === 'loading' || categories.length === 0}
              className="inline-flex items-center gap-2 rounded-full px-5 h-9 text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitState === 'loading' ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  {' '}
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  {' '}
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      ) : collapsedMessage}
    </div>
  );
}
