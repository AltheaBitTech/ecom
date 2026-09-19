import { Suspense } from 'react';
import { Catalog } from '@/components/storefront/catalog';
export default function ProductsPage() { return <Suspense fallback={<p className="store-container py-20">Loading collection…</p>}><Catalog /></Suspense>; }
