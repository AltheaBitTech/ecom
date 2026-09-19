'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ShieldCheck, Settings, Package, Boxes, ShoppingCart, Contact, CreditCard, BarChart3, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions';

const items = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, permission: null },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: PERMISSIONS.ORDERS_VIEW },
  { href: '/admin/products', label: 'Products', icon: Package, permission: PERMISSIONS.CATALOG_PRODUCTS_VIEW },
  { href: '/admin/storefront', label: 'Storefront & offers', icon: ShoppingCart, permission: PERMISSIONS.CATALOG_PRODUCTS_VIEW },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes, permission: PERMISSIONS.INVENTORY_STOCK_VIEW },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, permission: PERMISSIONS.ORDERS_VIEW },
  { href: '/admin/customers', label: 'Customers', icon: Contact, permission: PERMISSIONS.ORDERS_CUSTOMERS_VIEW },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard, permission: PERMISSIONS.PAYMENTS_VIEW },
  { href: '/admin/marketing', label: 'Marketing', icon: Megaphone, permission: PERMISSIONS.MARKETING_VIEW },
  { href: '/admin/users', label: 'Users', icon: Users, permission: PERMISSIONS.USERS_VIEW },
  { href: '/admin/roles', label: 'Roles', icon: ShieldCheck, permission: PERMISSIONS.ROLES_VIEW },
  { href: '/admin/settings', label: 'Settings', icon: Settings, permission: null },
] as const;

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  return (
    <nav className="grid gap-1 px-3">
      {items
        .filter((item) => item.permission === null || hasPermission(item.permission))
        .map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
