import { EmptyState, PageHeader } from '@/components/ui/primitives';

/** Placeholder until staff & role management lands (see roadmap M2+). */
export default function AdminStaff() {
  return (
    <div>
      <PageHeader title="Staff & roles" subtitle="Invite teammates and shape what they can do." />
      <EmptyState
        icon="⚙"
        title="Coming soon"
        description="Team management is on the way. You’ll invite staff and build custom roles here — the dashboard adapts to each role’s permissions automatically."
      />
    </div>
  );
}
