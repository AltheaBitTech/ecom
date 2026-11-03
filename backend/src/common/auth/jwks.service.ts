import { Injectable, Logger } from '@nestjs/common';

import { AppException } from '../errors/app-exception';
import { JwtService } from '../jwt/jwt.service';
import type { AccessTokenClaims } from '../jwt/jwt.types';

import type { CustomerPrincipal, StaffPrincipal } from './principal';

/**
 * Verifies ecom's own RS256 access tokens IN-PROCESS (no network hop). ecom now
 * mints and verifies its own tokens against the local keypair the JwtService
 * loaded at boot, so verification is a pure signature + issuer/audience/expiry
 * check with zero remote dependency.
 *
 * The class keeps the historical `JwksService` name (and `verify()` shape) so
 * the authentication guard is untouched; it simply delegates the crypto to
 * JwtService and projects the resulting claims onto a staff or customer
 * principal.
 */
@Injectable()
export class JwksService {
  private readonly logger = new Logger(JwksService.name);

  constructor(private readonly jwt: JwtService) {}

  /** Verify a bearer token and project it onto a staff or customer principal. */
  async verify(token: string): Promise<StaffPrincipal | CustomerPrincipal> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAccessToken(token);
    } catch (err) {
      this.logger.debug(`Token verification failed: ${(err as Error).message}`);
      throw AppException.unauthenticated('Invalid or expired token');
    }

    if (!claims.sub || !claims.tenant_id) {
      throw AppException.unauthenticated('Token is missing required claims');
    }

    if (claims.type === 'customer') {
      return {
        kind: 'customer',
        customerId: claims.sub,
        productId: claims.product_id,
        tenantId: claims.tenant_id,
      };
    }

    return {
      kind: 'staff',
      userId: claims.sub,
      productId: claims.product_id,
      tenantId: claims.tenant_id,
      role: claims.role ?? '',
      permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
      sessionId: claims.sid,
    };
  }
}
