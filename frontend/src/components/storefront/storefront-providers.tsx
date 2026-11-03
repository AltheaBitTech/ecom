'use client';

import { AccountProvider } from './account-provider';
import { CartProvider } from './cart-provider';

/** Client state shared across a store's pages: the basket and the shopper session. */
export function StorefrontProviders({ tenant, children }: { tenant: string; children: React.ReactNode }) {
  return (
    <CartProvider tenant={tenant}>
      <AccountProvider tenant={tenant}>{children}</AccountProvider>
    </CartProvider>
  );
}
