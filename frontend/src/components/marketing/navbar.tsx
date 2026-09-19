'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const { status } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full text-white transition-all duration-300 ease-md ${
        scrolled ? 'bg-[#0e3a41]/85 shadow-md backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight">
          <Package2 className="size-6" />
          Stallwart
        </Link>
        <nav className="hidden items-center gap-9 text-[0.95rem] font-medium md:flex">
          {[
            { href: '/#about', label: 'About' },
            { href: '/#platform', label: 'Platform' },
            { href: '/#pricing', label: 'Pricing' },
            { href: '/#faq', label: 'FAQ' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group relative py-1 text-white/85 transition-colors duration-300 hover:text-white">
              {l.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left scale-x-0 bg-[#e2643c] transition-transform duration-300 ease-md group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {status === 'authenticated' ? (
            <Button
              size="sm"
              className="h-10 rounded-full bg-[#e2643c] px-5 text-[0.95rem] text-white hover:bg-[#c94f2a]"
              nativeButton={false}
              render={<Link href="/admin" />}
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 rounded-full px-4 text-[0.95rem] text-white hover:bg-white/10 hover:text-white"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Sign in
              </Button>
              <Button
                size="sm"
                className="h-10 rounded-full bg-[#e2643c] px-5 text-[0.95rem] text-white hover:bg-[#c94f2a]"
                nativeButton={false}
                render={<Link href="/register" />}
              >
                Start free
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
