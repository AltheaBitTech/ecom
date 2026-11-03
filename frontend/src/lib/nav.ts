/**
 * Admin navigation is DATA, resolved against the signed-in user's permission
 * set. There are no `if (role === 'manager')` checks in the UI — a nav item
 * appears iff the user holds the permission it requires (or it requires none).
 * Building a custom role in the backend's RBAC module therefore reshapes the
 * dashboard with zero UI changes.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** Permission required to see this item; undefined ⇒ always visible. */
  permission?: string;
}

export const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: '◎' },
  { label: 'Products', href: '/admin/products', icon: '▦', permission: 'products:read' },
  { label: 'Categories', href: '/admin/categories', icon: '🗂', permission: 'products:read' },
  { label: 'Orders', href: '/admin/orders', icon: '🧾', permission: 'orders:read' },
  { label: 'Flash sales', href: '/admin/flash-sales', icon: '🏷', permission: 'promotions:read' },
  { label: 'Customers', href: '/admin/customers', icon: '👥', permission: 'customers:read' },
  { label: 'Staff & roles', href: '/admin/staff', icon: '⚙', permission: 'staff:read' },
  { label: 'Analytics', href: '/admin/analytics', icon: '📈', permission: 'analytics:read' },
  { label: 'Store design', href: '/admin/design', icon: '✦', permission: 'store_settings:read' },
  { label: 'Settings', href: '/admin/settings', icon: '⛭', permission: 'store_settings:read' },
];

export function visibleNav(permissions: string[]): NavItem[] {
  return ADMIN_NAV.filter((item) => !item.permission || permissions.includes(item.permission));
}
