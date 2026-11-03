import { redirect } from 'next/navigation';
import Link from 'next/link';

import { SignInForm } from '@/components/admin/sign-in-form';
import { getStaffSession } from '@/lib/session';

/**
 * Staff sign-in. Lives outside the dashboard shell (which requires a session), so
 * an unauthenticated visitor lands here instead of a redirect loop. If a valid
 * session already exists, skip straight to the dashboard.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; created?: string }>;
}) {
  const session = await getStaffSession();
  if (session) redirect('/admin');

  const { slug, created } = await searchParams;
  const notice = created
    ? 'Your store is ready. Sign in with the email and password you just chose.'
    : undefined;

  return (
    <main className="auth-shell auth-shell-storelab min-h-screen bg-[#f2f3f6] text-[#111827]">
      <section className="auth-story relative overflow-hidden bg-[#fff4f1] text-[#111827]">
        <Link href="/" className="auth-logo relative z-10">
          <span>✦</span> StoreLab
        </Link>

        <div className="relative z-10 my-auto max-w-xl py-16">
          <p className="auth-eyebrow text-[#e43f20]!">Welcome back</p>
          <h1 className="auth-headline mt-6">SEE YOUR<br /><span className="text-[#ff4b2b]">STORE CLEARLY.</span></h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[#667085] sm:text-lg">
            Products, customers, orders, settings, and growth—all waiting exactly where you left them.
          </p>

          <div className="auth-dashboard mt-12 max-w-lg rounded-xl border border-[#e4e7ec] bg-white p-5">
            <div className="flex items-center justify-between border-b border-[#e4e7ec] pb-4">
              <div><p className="text-[10px] uppercase tracking-[.18em] text-[#98a0ae]">Store health</p><p className="mt-1 font-display text-3xl font-bold">92/100</p></div>
              <span className="rounded-lg bg-[#fff0ec] px-3 py-1.5 text-xs font-bold text-[#e43f20]">Ready to grow</span>
            </div>
            <div className="mt-5 flex h-20 items-end gap-2" aria-hidden>
              {[32, 46, 38, 68, 52, 82, 64, 92, 76, 100].map((height, index) => (
                <span key={index} className="flex-1 rounded-t bg-[#ffe0da] last:bg-[#ff4b2b]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </div>

        <span className="auth-orbit auth-orbit-one" aria-hidden />
        <span className="auth-orbit auth-orbit-two" aria-hidden />
      </section>

      <section className="auth-form-side">
        <div className="w-full max-w-lg">
          <Link href="/" className="auth-mobile-logo auth-logo mb-12 lg:hidden">
            <span>✦</span> StoreLab
          </Link>
          <p className="auth-eyebrow">Merchant access · Secure</p>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-[-.055em] sm:text-5xl">Sign in</h2>
          <p className="mt-3 text-sm leading-6 text-black/50">Enter your store address and account details to continue.</p>

          <div className="mt-10">
            <SignInForm initialSlug={slug ?? ''} notice={notice} />
          </div>

          <div className="mt-8 flex flex-col justify-between gap-4 border-t border-black/10 pt-6 text-sm text-black/50 sm:flex-row">
            <p>New to StoreLab? <Link href="/start" className="font-bold text-[#111827] underline decoration-[#ff4b2b] decoration-2 underline-offset-4">Create a store ↗</Link></p>
            <p className="text-xs">Password stays private.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
