import { Module } from '@nestjs/common';

import { StaffService } from './staff.service';

/**
 * Tenant membership management (list / invite / accept / update / remove).
 * Exports StaffService for the admin team controller. crypto/redis/email/prisma
 * are @Global, so no imports are needed here.
 */
@Module({
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
