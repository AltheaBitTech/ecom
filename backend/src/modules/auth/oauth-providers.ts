// Minimal OAuth2 authorization-code config per provider — no passport, just fetch (see
// oauth.service.ts). Add a new provider by adding one entry here + one AuthProvider enum value.

export type OAuthProviderName = 'google' | 'facebook' | 'microsoft' | 'twitter';

export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  usesPkce?: boolean;
  /** How to send client credentials on the token exchange. */
  tokenAuth: 'body' | 'basic';
  /** Pulls the account's verified email out of that provider's userinfo response shape. */
  extractEmail: (profile: Record<string, unknown>) => string | undefined;
}

export const OAUTH_PROVIDERS: Record<OAuthProviderName, OAuthProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    tokenAuth: 'body',
    extractEmail: (p) => (typeof p.email === 'string' && p.email_verified === true ? p.email : undefined),
  },
  facebook: {
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=email,name',
    scope: 'email public_profile',
    tokenAuth: 'body',
    extractEmail: (p) => (typeof p.email === 'string' ? p.email : undefined),
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'openid email profile User.Read',
    tokenAuth: 'body',
    extractEmail: (p) =>
      (typeof p.mail === 'string' && p.mail) || (typeof p.userPrincipalName === 'string' ? p.userPrincipalName : undefined),
  },
  twitter: {
    // ponytail: X's API does not grant third-party apps the user's email address (no
    // equivalent of Google/Facebook's `email` scope) — extractEmail always returns undefined,
    // so OAuthService.socialLogin fails closed with "X doesn't share an email with this app".
    // Upgrade path if X ever exposes one: fill in extractEmail below, nothing else changes.
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    scope: 'users.read tweet.read',
    usesPkce: true,
    tokenAuth: 'basic',
    extractEmail: () => undefined,
  },
};
