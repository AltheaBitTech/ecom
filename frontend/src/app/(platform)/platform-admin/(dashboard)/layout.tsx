import { redirect } from 'next/navigation';
import { getPlatformToken } from '@/lib/platform-session';
import { PlatformNav } from '@/components/platform/platform-nav';

export default async function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  const token = await getPlatformToken();
  if (!token) redirect('/platform-admin/login');

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <PlatformNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
