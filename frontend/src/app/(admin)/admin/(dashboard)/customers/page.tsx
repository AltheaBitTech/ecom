import { EmptyState, PageHeader } from '@/components/ui/primitives';

/** Placeholder until customer management lands (see roadmap M2+). */
export default function AdminCustomers() {
  return (
    <div>
      <PageHeader title="Customers" subtitle="Your shoppers, their orders and addresses." />
      <EmptyState
        icon="👥"
        title="Coming soon"
        description="Customer management is on the way. You’ll browse shoppers and their order history here."
      />
    </div>
  );
}
