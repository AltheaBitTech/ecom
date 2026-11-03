import { redirect } from 'next/navigation';

export default async function CollectionPage({ params }: { params: Promise<{ tenant: string; category: string }> }) {
  const { tenant, category } = await params;
  redirect(`/${tenant}/products?category=${encodeURIComponent(category)}`);
}
