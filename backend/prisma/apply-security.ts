/**
 * Creates the non-superuser runtime role and applies row-level security.
 *
 *   npm run db:security
 *
 * Runs as the privileged owner (DIRECT_URL). Idempotent. This MUST run after
 * every migration that adds a tenant-owned table, so the new table is RLS-forced
 * before it ever serves a request.
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

// The runtime role the application connects as (DATABASE_URL). Non-superuser,
// so FORCE ROW LEVEL SECURITY actually binds it.
const RUNTIME_ROLE = process.env.RUNTIME_DB_ROLE ?? 'ecom_rls';
const RUNTIME_PASSWORD = process.env.RUNTIME_DB_PASSWORD ?? 'localdev_password';

async function main(): Promise<void> {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  try {
    // 1. Ensure the runtime role exists (idempotent).
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RUNTIME_ROLE}') THEN
          CREATE ROLE ${RUNTIME_ROLE} LOGIN PASSWORD '${RUNTIME_PASSWORD}';
        END IF;
      END $$;
    `);

    // 2. Grant it least-privilege DML on the current schema (no DDL, no superuser).
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${RUNTIME_ROLE};`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RUNTIME_ROLE};`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RUNTIME_ROLE};`,
    );
    // Future tables/sequences created by the owner inherit the same grants.
    await prisma.$executeRawUnsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RUNTIME_ROLE};`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${RUNTIME_ROLE};`,
    );

    // 3. Apply the RLS policies.
    const rls = readFileSync(join(__dirname, 'rls.sql'), 'utf8');
    await prisma.$executeRawUnsafe(rls);

    // eslint-disable-next-line no-console
    console.warn(`Applied RLS and provisioned runtime role "${RUNTIME_ROLE}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('apply-security failed:', err);
  process.exit(1);
});
