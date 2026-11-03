import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * The database gateway. Two entry points bound tenant access:
 *
 *   forTenant(tenantId, cb) — runs `cb` inside a transaction with the
 *     `app.current_tenant` GUC set transaction-locally. RLS then restricts every
 *     query in the callback to that tenant. This is the ONLY sanctioned way to
 *     read/write tenant-owned tables.
 *
 *   asPlatform(cb) — runs `cb` with `app.bypass_rls = on`, for the narrow set of
 *     operations that legitimately cross tenants (provisioning a tenant whose row
 *     does not yet exist, plan/seed maintenance). Every use is deliberate.
 *
 * `set_config(key, value, true)` scopes the setting to the current transaction,
 * so context can never leak to the next request on a pooled connection.
 */
export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }

  /** Run a unit of work scoped to one tenant under row-level security. */
  async forTenant<T>(tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    if (!tenantId) {
      // Defense in depth: never open a tenant transaction without a scope.
      throw new Error('forTenant called without a tenantId');
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      return work(tx);
    });
  }

  /** Run a unit of work with RLS bypassed — cross-tenant, deliberate, audited. */
  async asPlatform<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return work(tx);
    });
  }
}
