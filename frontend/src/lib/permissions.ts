// Mirrors backend/src/modules/roles/permissions.catalog.ts — keep in sync by hand;
// the catalog only grows when a module ships, so drift risk is low.
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
  MARKETING_VIEW: 'marketing.campaigns.view.tenant',
  MARKETING_SEND: 'marketing.campaigns.send.tenant',
} as const;
