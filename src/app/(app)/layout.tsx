import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import { AppShell } from './_components/AppShell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  async function logoutAction() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return <AppShell logoutAction={logoutAction}>{children}</AppShell>;
}
