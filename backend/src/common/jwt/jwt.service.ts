import { Injectable, OnModuleInit } from '@nestjs/common';
import { importPKCS8, importSPKI, exportJWK, SignJWT, jwtVerify, type JWK, type KeyLike } from 'jose';

import { AppConfig } from '../config/app-config';

import { AccessTokenClaims, ECOM_PRODUCT_ID, IssueAccessTokenInput } from './jwt.types';

const ALG = 'RS256';

/**
 * Issues and verifies RS256 access tokens, and publishes the public half as a
 * JWKS document at /.well-known/jwks.json.
 *
 * Asymmetric by design: this service holds the PRIVATE key and signs; the token
 * is verified IN-PROCESS on every request (no network hop, unlike the former
 * remote auth-rbac JWKS). The public JWK is also served so external verifiers
 * (and the frontend) can validate independently.
 */
@Injectable()
export class JwtService implements OnModuleInit {
  private privateKey!: KeyLike;
  private publicKey!: KeyLike;
  private publicJwk!: JWK;

  private readonly kid: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTtl: number;
  private readonly privatePem: string;
  private readonly publicPem: string;

  constructor(config: AppConfig) {
    this.kid = config.jwtKeyId;
    this.issuer = config.jwtIssuer;
    this.audience = config.jwtAudience;
    this.accessTtl = config.accessTokenTtl;
    this.privatePem = config.jwtPrivateKey;
    this.publicPem = config.jwtPublicKey;
  }

  async onModuleInit(): Promise<void> {
    this.privateKey = await importPKCS8(this.privatePem, ALG);
    this.publicKey = await importSPKI(this.publicPem, ALG);
    this.publicJwk = { ...(await exportJWK(this.publicKey)), kid: this.kid, alg: ALG, use: 'sig' };
  }

  /** Sign a short-lived access token. */
  async issueAccessToken(input: IssueAccessTokenInput): Promise<{ token: string; expiresIn: number }> {
    const token = await new SignJWT({
      product_id: input.productId ?? ECOM_PRODUCT_ID,
      tenant_id: input.tenantId,
      role: input.role,
      permissions: input.permissions,
      type: input.type,
      ...(input.sessionId ? { sid: input.sessionId } : {}),
    })
      .setProtectedHeader({ alg: ALG, kid: this.kid, typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtl}s`)
      .sign(this.privateKey);

    return { token, expiresIn: this.accessTtl };
  }

  /** Verify a token's signature, issuer, audience and expiry. Throws on failure. */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: this.issuer,
      audience: this.audience,
      algorithms: [ALG],
    });
    return payload as unknown as AccessTokenClaims;
  }

  /** The JWKS document served at /.well-known/jwks.json. */
  getJwks(): { keys: JWK[] } {
    return { keys: [this.publicJwk] };
  }
}
