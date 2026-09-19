import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  tenantId?: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ip?: string;
  userAgent?: string;
  success?: boolean;
}

/** Immutable audit trail. Write-only from application code — never updated or deleted. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        previousValue: entry.previousValue as never,
        newValue: entry.newValue as never,
        ip: entry.ip,
        userAgent: entry.userAgent,
        success: entry.success ?? true,
      },
    });
  }
}
