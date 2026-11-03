import { Global, Module } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

/**
 * Cross-cutting observability providers. AuditService is exported (and the
 * module is global) so both the AuditInterceptor and any feature service can
 * record entries. The interceptors and request-context middleware themselves are
 * wired as globals in AppModule. PrismaService comes from the global PrismaModule.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class ObservabilityModule {}
