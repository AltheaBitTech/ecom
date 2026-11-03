import { Module } from '@nestjs/common';

import { JwksController, TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

/**
 * Publishes the JWKS document and server-to-server token introspection +
 * targeted session revocation. Exports TokensService. jwt/prisma are @Global, so
 * no imports are needed here.
 */
@Module({
  controllers: [JwksController, TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
