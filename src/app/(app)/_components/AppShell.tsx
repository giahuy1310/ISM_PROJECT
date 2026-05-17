'use client';

import { PageTransition } from './PageTransition';
import { SideNav } from './SideNav';
import { TopNav } from './TopNav';

export function AppShell({
  children,
  logoutAction,
}: {
  children: React.ReactNode;
  logoutAction: () => Promise<void>;
}) {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex antialiased">
      <SideNav logoutAction={logoutAction} />
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopNav />
        <PageTransition>
          <main className="flex-1 p-6 md:p-8 space-y-6">{children}</main>
        </PageTransition>
      </div>
    </div>
  );
}
