import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { EnvConfig } from '../../common/config/env.validation';
import { TokenService, type OAuthState } from '../../common/auth/token.service';
import { OAUTH_PROVIDERS, type OAuthProviderName } from './oauth-providers';

const CLIENT_ID_KEY: Record<OAuthProviderName, keyof EnvConfig> = {
  google: 'GOOGLE_CLIENT_ID',
  facebook: 'FACEBOOK_CLIENT_ID',
  microsoft: 'MICROSOFT_CLIENT_ID',
  twitter: 'TWITTER_CLIENT_ID',
};
const CLIENT_SECRET_KEY: Record<OAuthProviderName, keyof EnvConfig> = {
  google: 'GOOGLE_CLIENT_SECRET',
  facebook: 'FACEBOOK_CLIENT_SECRET',
  microsoft: 'MICROSOFT_CLIENT_SECRET',
  twitter: 'TWITTER_CLIENT_SECRET',
};

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly tokens: TokenService,
  ) {}

  private credentials(provider: OAuthProviderName): { clientId: string; clientSecret: string } {
    const clientId = this.config.get(CLIENT_ID_KEY[provider], { infer: true }) as string | undefined;
    const clientSecret = this.config.get(CLIENT_SECRET_KEY[provider], { infer: true }) as string | undefined;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(`${provider} sign-in isn't configured`);
    }
    return { clientId, clientSecret };
  }

  private callbackUrl(provider: OAuthProviderName): string {
    return `${this.config.get('BACKEND_URL', { infer: true })}/auth/oauth/${provider}/callback`;
  }

  /** Builds the URL to send the browser to, and the signed state it must come back with. */
  buildAuthorizeUrl(provider: OAuthProviderName, target: { mode: 'login'; tenantSlug: string } | { mode: 'register' }): string {
    const cfg = OAUTH_PROVIDERS[provider];
    const { clientId } = this.credentials(provider);
    const codeVerifier = cfg.usesPkce ? base64url(crypto.randomBytes(32)) : undefined;
    const state = this.tokens.signOAuthState({ ...target, codeVerifier });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.callbackUrl(provider),
      response_type: 'code',
      scope: cfg.scope,
      state,
    });
    if (codeVerifier) {
      const challenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }
    return `${cfg.authorizeUrl}?${params.toString()}`;
  }

  /** Exchanges the callback's ?code for the account's email, resolving the tenant it started from. */
  async resolveEmail(
    provider: OAuthProviderName,
    code: string,
    stateToken: string,
  ): Promise<{ state: OAuthState; email: string | undefined }> {
    const oauthState = this.tokens.verifyOAuthState(stateToken);
    const { codeVerifier } = oauthState;
    const cfg = OAUTH_PROVIDERS[provider];
    const { clientId, clientSecret } = this.credentials(provider);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.callbackUrl(provider),
    });
    if (codeVerifier) body.set('code_verifier', codeVerifier);

    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (cfg.tokenAuth === 'basic') {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    } else {
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
    }

    const tokenRes = await fetch(cfg.tokenUrl, { method: 'POST', headers, body });
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
      throw new BadRequestException(`${provider} sign-in failed: could not exchange code`);
    }

    const profileRes = await fetch(cfg.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = (await profileRes.json().catch(() => ({}))) as Record<string, unknown>;
    return { state: oauthState, email: cfg.extractEmail(profile) };
  }
}
