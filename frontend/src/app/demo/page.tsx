import Link from 'next/link';

import { Button } from '@/components/ui/button';

/** Placeholder for the public demo store until a curated demo tenant ships. */
export default function DemoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-soft px-6 py-12">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          StoreLab
        </Link>
        <div className="card mt-8 px-6 py-16">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-sunken text-xl">
            🏬
          </div>
          <h1 className="text-xl font-semibold">Demo store — coming soon</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            We’re putting together a fully-stocked example store you can explore. In the meantime,
            spin up your own in under a minute.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button href="/start">Start a store</Button>
            <Button href="/" variant="secondary">
              Back home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
