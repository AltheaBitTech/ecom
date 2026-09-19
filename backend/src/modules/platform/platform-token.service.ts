import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvConfig } from '../../common/config/env.validation';

export interface PlatformTokenPayload {
  sub: string; // platform admin id
  email: string;
  typ: 'platform'; // discriminator so a tenant access token can never be replayed here (or vice versa)
}

// ponytail: access-token only, no refresh rotation — platform admins are few and re-login on
// expiry is fine at this scale. Add refresh tokens (mirroring TokenService) if that changes.
@Injectable()
export class PlatformTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  sign(payload: Omit<PlatformTokenPayload, 'typ'>): string {
    return this.jwt.sign(
      { ...payload, typ: 'platform' },
      { secret: this.config.get('PLATFORM_JWT_SECRET', { infer: true }), expiresIn: '12h' },
    );
  }

  verify(token: string): PlatformTokenPayload {
    const payload = this.jwt.verify<PlatformTokenPayload>(token, {
      secret: this.config.get('PLATFORM_JWT_SECRET', { infer: true }),
    });
    if (payload.typ !== 'platform') throw new Error('Not a platform token');
    return payload;
  }
}
