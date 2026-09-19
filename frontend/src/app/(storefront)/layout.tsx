import { StorefrontHeader } from './_components/storefront-header';
import { StorefrontFooter } from './_components/storefront-footer';
import { StoreProvider } from '@/components/storefront/store-provider';
import './storefront.css';
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <StoreProvider><div className="storefront flex min-h-full flex-1 flex-col"><a href="#store-main" className="sr-only focus:not-sr-only focus:p-4">Skip to content</a><StorefrontHeader /><main id="store-main" className="flex-1">{children}</main><StorefrontFooter /></div></StoreProvider>;
}
