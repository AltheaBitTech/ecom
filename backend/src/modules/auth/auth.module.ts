import { Module } from '@nestjs/common';

import { MfaModule } from '../mfa/mfa.module';
import { RbacModule } from '../rbac/rbac.module';

import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/**
 * Staff authentication: password login (+ lockout + MFA), session rotation, and
 * password reset. Depends on RbacModule (permission resolution) and MfaModule
 * (TOTP verification). crypto/redis/email/jwt/prisma are @Global. The existing
 * admin controller sets the refresh cookie; SessionService just returns the raw
 * token string.
 */
@Module({
  imports: [RbacModule, MfaModule],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
