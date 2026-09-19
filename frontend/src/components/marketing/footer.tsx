import Link from 'next/link';
import { Package2 } from 'lucide-react';

const links = [
  { href: '/#about', label: 'About' },
  { href: '/#platform', label: 'Platform' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

const legalLinks = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/refund-policy', label: 'Refund & Returns' },
];

export function Footer() {
  return (
    <footer className="bg-[#0c2126] text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Package2 className="size-4" />
            Stallwart
          </p>
          <p className="mt-2 max-w-xs">A one-stop platform for anyone who wants to sell online.</p>
        </div>
        <nav className="flex flex-wrap gap-x-7 gap-y-2 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
            <a href="mailto:support@altheabit.com" className="transition-colors hover:text-white">
              support@altheabit.com
            </a>
          </nav>
          <p className="text-xs">&copy; {new Date().getFullYear()} Stallwart. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
