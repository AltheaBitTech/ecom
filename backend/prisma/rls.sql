-- Row-level security policies for every tenant-owned table.
--
-- Model: the runtime role (ecom_rls) is a NON-superuser subject to FORCE ROW
-- LEVEL SECURITY. Each policy admits a row only when the request has set the
-- `app.current_tenant` GUC to that row's tenant, OR when `app.bypass_rls` is
-- 'on' (the narrow, audited platform path). Both GUCs are read with the
-- missing-ok form `current_setting(..., true)`, so if application code queries
-- tenant data WITHOUT a context the predicate is NULL -> the row is hidden.
-- Isolation therefore fails CLOSED (zero rows), never open.
--
-- The whole file is a single DO block: it is applied via one prepared
-- statement (Prisma $executeRawUnsafe), which forbids multiple commands.
-- Idempotent: safe to re-run.

DO $$
DECLARE
  t text;
  -- `tenants` keys on its own primary key `id`; the rest key on `tenant_id`.
  key_col text;
  tables text[] := ARRAY[
    'tenants',
    'tenant_settings',
    'subscriptions',
    'categories',
    'products',
    'orders',
    'order_items',
    'payment_accounts',
    'payments',
    'shipping_accounts',
    'shipments',
    'customer_addresses',
    'media_assets',
    'flash_sales',
    'audit_logs',
    -- Identity tables folded in from the former auth-rbac-service. These follow
    -- the uniform tenant_id policy. `roles` does NOT (it allows NULL-tenant
    -- system templates to be read) and is handled separately below.
    'user_tenant_roles',
    'customers',
    'domains'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    key_col := CASE WHEN t = 'tenants' THEN 'id' ELSE 'tenant_id' END;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (' ||
      'current_setting(''app.bypass_rls'', true) = ''on'' OR ' ||
      '%I = current_setting(''app.current_tenant'', true)) WITH CHECK (' ||
      'current_setting(''app.bypass_rls'', true) = ''on'' OR ' ||
      '%I = current_setting(''app.current_tenant'', true));',
      t, key_col, key_col
    );
  END LOOP;

  -- `roles` special case: a tenant may READ the NULL-tenant system templates
  -- (Admin/Contributor/Reader) so provisioning can clone them, but may only
  -- WRITE rows scoped to its own tenant. So USING admits NULL tenant_id;
  -- WITH CHECK does not. Fails closed with no context (both GUCs NULL -> hidden).
  EXECUTE 'ALTER TABLE roles ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE roles FORCE ROW LEVEL SECURITY;';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON roles;';
  EXECUTE
    'CREATE POLICY tenant_isolation ON roles USING (' ||
    'current_setting(''app.bypass_rls'', true) = ''on'' OR ' ||
    'tenant_id IS NULL OR ' ||
    'tenant_id = current_setting(''app.current_tenant'', true)) WITH CHECK (' ||
    'current_setting(''app.bypass_rls'', true) = ''on'' OR ' ||
    'tenant_id = current_setting(''app.current_tenant'', true));';
  -- `role_permissions` has no tenant_id; it is reachable only via a roleId that
  -- was already filtered by the `roles` policy, so it is intentionally left
  -- without RLS (matches the former auth-rbac-service).
END $$;
