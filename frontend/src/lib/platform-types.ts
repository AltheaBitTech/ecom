export interface PlatformOverview {
  tenantsByStatus: Record<string, number>;
  totalTenants: number;
  activeSubscriptions: number;
  mrrCents: number;
  totalOrders: number;
  gmvCents: number;
  signups30d: { date: string; count: number }[];
}

export interface PlatformTenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  orderCount: number;
  gmvCents: number;
  subscriptionStatus: string | null;
  planName: string | null;
}

export interface PlatformTenantsPage {
  data: PlatformTenantRow[];
  total: number;
  page: number;
  pageSize: number;
}
