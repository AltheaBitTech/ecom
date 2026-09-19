import Link from 'next/link';
import { Package2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThreeScene } from '@/components/three-scene';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full flex-1 lg:grid-cols-2">
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10"
        style={{ background: 'linear-gradient(180deg,#0c2f38 0%,#14505c 34%,#2b7a80 55%,#c9633a 80%,#e8a34c 100%)' }}
      >
        <ThreeScene className="absolute inset-0" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 70% at 50% 108%, rgba(255,196,120,.45) 0%, rgba(226,100,60,.2) 35%, transparent 65%)' }}
        />
        <Link href="/" className="relative z-10 flex items-center gap-2 font-semibold tracking-tight text-white">
          <Package2 className="size-5" />
          Stallwart
        </Link>
        <div className="relative z-10 max-w-md text-white">
          <p className="font-display text-3xl leading-tight">One workspace. Every seller&apos;s own storefront, orders, and team.</p>
          <p className="mt-4 text-sm text-white/70">Multi-tenant commerce, isolated by design — your data never crosses into anyone else&apos;s.</p>
        </div>
      </div>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-6 lg:justify-end">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight lg:hidden">
            <Package2 className="size-5" />
            Stallwart
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-16">{children}</main>
      </div>
    </div>
  );
}
