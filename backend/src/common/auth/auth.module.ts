import { Global, Module } from '@nestjs/common';

import { AuthenticationGuard } from './authentication.guard';
import { AuthorizationGuard } from './authorization.guard';
import { JwksService } from './jwks.service';

/**
 * Identity plumbing. Exposes the in-process token verifier and both guards so
 * app.module can wire them as global APP_GUARDs (authenticate first, then
 * authorize). Token verification is now local (JwtService); there is no longer
 * an outbound identity client.
 */
@Global()
@Module({
  providers: [JwksService, AuthenticationGuard, AuthorizationGuard],
  exports: [JwksService, AuthenticationGuard, AuthorizationGuard],
})
export class AuthModule {}
