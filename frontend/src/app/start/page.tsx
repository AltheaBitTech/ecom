import Link from 'next/link';

import { OnboardForm } from '@/components/marketing/onboard-form';

/**
 * Self-serve merchant onboarding — the "Start a store" entry point from the
 * marketing landing. Creates the store and its owner in one step; the owner can
 * sign in immediately afterward.
 */
const PLANS = new Set(['starter', 'pro', 'enterprise']);

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const defaultPlan = plan && PLANS.has(plan) ? plan : 'starter';
  return (
    <main className="auth-shell auth-shell-storelab min-h-screen bg-[#f2f3f6] text-[#111827]">
      <section className="auth-story relative overflow-hidden bg-[#fff4f1] text-[#111827]">
        <Link href="/" className="auth-logo relative z-10">
          <span>✦</span> StoreLab
        </Link>

        <div className="relative z-10 my-auto max-w-xl py-16">
          <p className="auth-eyebrow text-[#e43f20]!">Your store starts here</p>
          <h1 className="auth-headline mt-6">BUILD WITH<br /><span className="text-[#ff4b2b]">CLARITY.</span></h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[#667085] sm:text-lg">
            Your products, storefront, customers, payments, and shipping in one calm workspace.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-3 border-y border-[#ffd1c8] py-5">
            <div><strong className="auth-stat">₹0</strong><span>to start</span></div>
            <div><strong className="auth-stat">5m</strong><span>to launch</span></div>
            <div><strong className="auth-stat">24/7</strong><span>selling</span></div>
          </div>
        </div>

        <div className="auth-art auth-art-store" aria-hidden>
          <span className="auth-art-ring" />
          <span className="auth-art-card">NEW<br />DROP<span>↗</span></span>
          <span className="auth-art-pill">STORE LIVE · 00:05</span>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="w-full max-w-xl">
          <Link href="/" className="auth-mobile-logo auth-logo mb-12 lg:hidden">
            <span>✦</span> StoreLab
          </Link>
          <p className="auth-eyebrow">Create your workspace · 01</p>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-[-.055em] sm:text-5xl">Start your store</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-black/50">
            Tell us the essentials. You can refine the theme, catalog, and team after launch.
          </p>

          <div className="mt-10">
            <OnboardForm defaultPlan={defaultPlan} />
          </div>

          <p className="mt-8 border-t border-black/10 pt-6 text-sm text-black/50">
            Already have a store?{' '}
            <Link href="/admin/sign-in" className="font-bold text-[#111827] underline decoration-[#ff4b2b] decoration-2 underline-offset-4">
              Sign in instead ↗
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
