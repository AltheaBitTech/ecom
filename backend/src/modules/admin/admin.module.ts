import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { StaffModule } from '../staff/staff.module';

import { AdminAuthController } from './admin-auth.controller';
import { AdminTeamController } from './admin-team.controller';

/**
 * Merchant admin plane: staff sign-in (native AuthService) and team management
 * (native RbacService + StaffService). The commerce admin surfaces (products,
 * orders, settings, …) live in their own feature modules under
 * `tenants/:tenantId/*`; this module adds the identity + team pieces the
 * dashboard needs to be fully self-serve.
 */
@Module({
  imports: [AuthModule, RbacModule, StaffModule],
  controllers: [AdminAuthController, AdminTeamController],
})
export class AdminModule {}
