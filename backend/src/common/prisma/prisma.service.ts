import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// Models that carry a tenantId column and must never be queried across tenants.
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Role',
  'AuditLog',
  'Product',
  'ProductVariant',
  'Coupon',
  'Review',
  'InventoryItem',
  'Customer',
  'Order',
  'Payment',
  'Invoice',
  'Subscription',
  'ReferralCode',
  'ReturnRequest',
  'Notification',
  'Campaign',
]);

/**
 * Single chokepoint for tenant-scoped data access.
 *
 * `forTenant(tenantId)` returns a client extension that transparently injects
 * `tenantId` into every where-clause and create/update payload for tenant-scoped
 * models, so a service can never accidentally forget the filter. This is
 * application-level isolation.
 *
 * ponytail: this is app-level isolation only, not Postgres RLS. It is correct as
 * long as every read/write for a tenant-scoped model goes through
 * `PrismaService.forTenant()` (enforced by convention + code review today, not
 * by the type system). Upgrade path if a stronger guarantee is needed: enable
 * RLS with `SET LOCAL app.tenant_id` per request transaction, so isolation holds
 * even if a future service bypasses this helper.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      void app.close();
    });
  }

  forTenant(tenantId: string) {
    if (!tenantId) {
      throw new Error('forTenant() requires a tenantId');
    }
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_SCOPED_MODELS.has(model)) {
              return query(args);
            }
            const a = args as Record<string, unknown>;
            if (['create'].includes(operation)) {
              a.data = { ...(a.data as object), tenantId };
            } else if (['createMany'].includes(operation)) {
              const dataArr = a.data as unknown[];
              a.data = Array.isArray(dataArr) ? dataArr.map((d) => ({ ...(d as object), tenantId })) : dataArr;
            } else if (
              ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate'].includes(
                operation,
              )
            ) {
              a.where = { ...(a.where as object), tenantId };
            }
            return query(a as never);
          },
        },
      },
    }) as PrismaClient;
  }
}

export type TenantScopedPrisma = ReturnType<PrismaService['forTenant']>;
export type { Prisma };
