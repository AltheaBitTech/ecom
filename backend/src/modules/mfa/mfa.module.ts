import { Module } from '@nestjs/common';

import { MfaService } from './mfa.service';

/**
 * TOTP MFA enrollment (setup / enable / disable / backup codes). Exports
 * MfaService so AuthService can verify codes during login. crypto/redis/prisma
 * are @Global, so no imports are needed here.
 */
@Module({
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
