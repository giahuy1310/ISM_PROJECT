import { DevSqlWorkspace } from './_components/DevSqlWorkspace';

export default function DevPage() {
  return (
    <section className="space-y-6 max-w-5xl">
      <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]">
        <span className="material-symbols-outlined text-4xl text-on-primary-fixed inline-block">terminal</span>
        <h1 className="mt-3 text-3xl font-headline font-black text-on-primary-fixed">Dev SQL Workspace</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Run SQL statements directly against the local database for development data manipulation.
        </p>
      </div>

      <DevSqlWorkspace />
    </section>
  );
}
