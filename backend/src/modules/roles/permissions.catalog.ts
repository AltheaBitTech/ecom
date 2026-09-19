/**
 * Permission catalog for the modules that exist today. Format: module.resource.action.scope
 * (see spec). Add to this list only when the module it names actually ships —
 * permissions for catalog/orders/etc. are added alongside those modules, not speculatively.
 */
export const PERMISSIONS = {
  USERS_VIEW: 'users.users.view.tenant',
  USERS_INVITE: 'users.users.invite.tenant',
  USERS_UPDATE: 'users.users.update.tenant',
  USERS_SUSPEND: 'users.users.suspend.tenant',
  ROLES_VIEW: 'users.roles.view.tenant',
  ROLES_MANAGE: 'users.roles.manage.tenant',
  TENANT_SETTINGS_VIEW: 'tenant.settings.view.tenant',
  TENANT_SETTINGS_UPDATE: 'tenant.settings.update.tenant',
  AUDIT_VIEW: 'audit.logs.view.tenant',
  CATALOG_PRODUCTS_VIEW: 'catalog.products.view.tenant',
  CATALOG_PRODUCTS_MANAGE: 'catalog.products.manage.tenant',
  INVENTORY_STOCK_VIEW: 'inventory.stock.view.tenant',
  INVENTORY_STOCK_ADJUST: 'inventory.stock.adjust.tenant',
  ORDERS_VIEW: 'orders.orders.view.tenant',
  ORDERS_MANAGE: 'orders.orders.manage.tenant',
  ORDERS_CUSTOMERS_VIEW: 'orders.customers.view.tenant',
  ORDERS_CUSTOMERS_MANAGE: 'orders.customers.manage.tenant',
  PAYMENTS_VIEW: 'orders.payments.view.tenant',
  BILLING_VIEW: 'billing.subscription.view.tenant',
  BILLING_MANAGE: 'billing.subscription.manage.tenant',
  MARKETING_VIEW: 'marketing.campaigns.view.tenant',
  MARKETING_SEND: 'marketing.campaigns.send.tenant',
  REFERRALS_VIEW: 'referrals.referrals.view.tenant',
  REFERRALS_MANAGE: 'referrals.referrals.manage.tenant',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS);

// Predefined system roles seeded for every new tenant. Their permission sets are
// maintained by the platform, not editable by tenant admins (isSystem = true).
export const SYSTEM_ROLES: Record<string, string[]> = {
  'Tenant Owner': ALL_PERMISSIONS,
  'Tenant Administrator': ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.TENANT_SETTINGS_UPDATE),
  Analyst: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.ROLES_VIEW,
    PERMISSIONS.TENANT_SETTINGS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.CATALOG_PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_STOCK_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CUSTOMERS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.MARKETING_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.REFERRALS_VIEW,
  ],
};
