import { getProductMeta, getProductsTable } from '../dashboard/analytics-api';
import { AddProductPanel } from './_components/AddProductPanel';
import { ProductTable } from './_components/ProductTable';

export default async function ProductsPage() {
  const products = await getProductsTable().catch(() => null);
  const productMeta = await getProductMeta().catch(() => null);
  const categories = productMeta?.categories ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-black text-on-primary-fixed">Products</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Search by product id, name, or sub category, and sort each column.
        </p>
      </div>
      <AddProductPanel categories={categories} />
      {products ? (
        <ProductTable rows={products} />
      ) : (
        <p className="text-sm text-on-surface-variant">Product data is temporarily unavailable.</p>
      )}
    </section>
  );
}
