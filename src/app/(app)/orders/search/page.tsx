import { SearchOrderView } from '../_components/SearchOrderView';

export default function SearchOrdersPage() {
  return (
    <section className="space-y-6 max-w-7xl">
      <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
        <h1 className="text-3xl font-headline font-black text-on-primary-fixed">Search Orders</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Search by order fields (excluding financial factors), view paginated results, and open details.
        </p>
      </div>
      <SearchOrderView />
    </section>
  );
}
