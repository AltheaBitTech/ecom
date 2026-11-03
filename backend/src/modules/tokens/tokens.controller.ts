import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth, Public } from '../../common/auth/decorators';
import { NoEnvelope } from '../../common/http/response.interceptor';
import { JwtService } from '../../common/jwt/jwt.service';

import { IntrospectDto, RevokeDto } from './dto/tokens.dto';
import { TokensService } from './tokens.service';

/**
 * Publishes ecom's public signing key as a JWKS document so external verifiers
 * (and any future extracted service) can validate ecom-issued tokens. Served
 * unversioned at /.well-known/jwks.json and outside the success envelope, since
 * JWKS consumers expect the raw `{ keys: [...] }` shape.
 */
@ApiTags('jwks')
@Controller()
export class JwksController {
  constructor(private readonly jwt: JwtService) {}

  @Get('.well-known/jwks.json')
  @Public()
  @NoEnvelope()
  jwks() {
    return this.jwt.getJwks();
  }
}

/**
 * Server-to-server token operations. Introspection is the revocation-aware check
 * (it consults the session row, which local JWT verification cannot see); revoke
 * ends a specific session. Both require the internal key.
 */
@ApiTags('tokens')
@Controller('tokens')
@Auth('internal')
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @Post('introspect')
  @HttpCode(200)
  introspect(@Body() dto: IntrospectDto) {
    return this.tokens.introspect(dto.token);
  }

  @Post('revoke')
  @HttpCode(204)
  async revoke(@Body() dto: RevokeDto): Promise<void> {
    await this.tokens.revokeSession(dto.session_id);
  }
}
