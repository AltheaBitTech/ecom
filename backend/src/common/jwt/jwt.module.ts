import { Global, Module } from '@nestjs/common';

import { JwtService } from './jwt.service';

/** Global RS256 token signing/verification + JWKS. */
@Global()
@Module({
  providers: [JwtService],
  exports: [JwtService],
})
export class JwtModule {}
