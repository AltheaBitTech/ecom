import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  /** Owning tenant. Required — the audit log is a tenant-owned, RLS table. */
  tenantId: string;
  actorKind: 'staff' | 'customer' | 'internal' | 'system';
  actorId?: string | null;
  action: string;
  target?: string | null;
  method: string;
  route: string;
  statusCode: number;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail. `record` never throws: an audit write must not break
 * the request it describes, so failures are logged and swallowed. Writes go
 * through the tenant's RLS context, matching every other tenant-owned table.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.forTenant(entry.tenantId, (tx) =>
        tx.auditLog.create({
          data: {
            tenantId: entry.tenantId,
            actorKind: entry.actorKind,
            actorId: entry.actorId ?? null,
            action: entry.action,
            target: entry.target ?? null,
            method: entry.method,
            route: entry.route,
            statusCode: entry.statusCode,
            requestId: entry.requestId ?? null,
            ipAddress: entry.ipAddress ?? null,
            metadata: (entry.metadata ?? {}) as object,
          },
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${entry.action} (tenant ${entry.tenantId})`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
