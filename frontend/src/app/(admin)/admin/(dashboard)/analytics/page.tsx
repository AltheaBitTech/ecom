import { EmptyState, PageHeader } from '@/components/ui/primitives';

/** Placeholder until analytics lands (see roadmap M2+). */
export default function AdminAnalytics() {
  return (
    <div>
      <PageHeader title="Analytics" subtitle="Sales, traffic and product performance." />
      <EmptyState
        icon="📈"
        title="Coming soon"
        description="Analytics are on the way. You’ll track sales, top products and traffic here."
      />
    </div>
  );
}
