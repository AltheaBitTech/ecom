'use client';

import Link from 'next/link';

import { useAccount } from './account-provider';
import { useCart } from './cart-provider';

/** The right side of the store header: account link + a live cart count badge. */
export function HeaderActions({ tenant }: { tenant: string }) {
  const { count } = useCart();
  const { user, loading } = useAccount();

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link
        href={`/${tenant}/account`}
        className="store-header-action grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white/40 text-sm transition hover:bg-white sm:flex sm:w-auto sm:px-4 sm:text-xs sm:font-bold"
        aria-label={loading ? 'Account' : user ? 'My account' : 'Sign in'}
      >
        <span aria-hidden>◎</span><span className="hidden sm:inline">{loading ? 'Account' : user ? 'My account' : 'Sign in'}</span>
      </Link>
      <Link
        href={`/${tenant}/cart`}
        className="store-header-cart relative flex h-10 items-center gap-2 rounded-full bg-[#151517] px-3.5 text-xs font-bold text-white transition hover:bg-brand sm:px-4"
      >
        <span className="hidden sm:inline">Cart</span><span aria-hidden>Bag</span>
        {count > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-fg">
            {count}
          </span>
        )}
      </Link>
    </div>
  );
}
