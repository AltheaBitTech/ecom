import { Module } from '@nestjs/common';

import { RbacService } from './rbac.service';

/**
 * Role-based access control: role CRUD, permission resolution, and cloning the
 * system-role templates into a tenant at provisioning time. Exports RbacService
 * so the auth and tenant-provisioning modules can consume it. crypto/redis/email/
 * jwt/prisma are @Global, so no imports are needed here.
 */
@Module({
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
