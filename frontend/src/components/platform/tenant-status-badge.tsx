import { Badge } from '@/components/ui/badge';

const VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  PENDING_VERIFICATION: 'secondary',
  UNDER_REVIEW: 'secondary',
  PROFILE_INCOMPLETE: 'secondary',
  REVISION_REQUESTED: 'outline',
  SUSPENDED: 'destructive',
  REJECTED: 'destructive',
  DEACTIVATED: 'outline',
};

export function TenantStatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANT[status] ?? 'outline'}>{status.replaceAll('_', ' ').toLowerCase()}</Badge>;
}
