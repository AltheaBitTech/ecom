import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import type { EnvConfig } from '../../common/config/env.validation';
import { TenantsService } from '../tenants/tenants.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { OAuthService } from './oauth.service';
import { OAUTH_PROVIDERS, type OAuthProviderName } from './oauth-providers';

const REFRESH_COOKIE = 'refresh_token';

function isOAuthProvider(value: string): value is OAuthProviderName {
  return value in OAUTH_PROVIDERS;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly tenants: TenantsService,
    private readonly oauth: OAuthService,
  ) {}

  @Get('me')
  @RequirePermissions()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current session: tenant, user, and live permissions' })
  async me(@CurrentUser() auth: AuthContext) {
    const tenant = await this.tenants.findById(auth.tenantId);
    return {
      tenant: tenant && {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        gstin: tenant.gstin,
        legalName: tenant.legalName,
        pan: tenant.pan,
        billingAddress: tenant.billingAddress,
        logoUrl: tenant.logoUrl,
        state: tenant.state,
      },
      user: { id: auth.userId, email: auth.email, permissions: auth.permissions },
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new tenant + its owner user; seeds system roles' })
  @Post('register')
  async register(@Body() dto: RegisterTenantDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.registerTenant(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, tenant: result.tenant, user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in with tenantSlug + email + password' })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, tenant: result.tenant, user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh-token cookie for a new access token' })
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Missing refresh token');
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, tenant: result.tenant, user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Email a password-reset link (same response whether or not the account exists)' })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Set a new password using the emailed token; signs out all sessions' })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.auth.resetPassword(dto.token, dto.password, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return { success: true };
  }

  @Public()
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiParam({ name: 'provider', enum: Object.keys(OAUTH_PROVIDERS) })
  @ApiOperation({
    summary: 'Redirect to a social provider — sign in to a workspace (tenantSlug) or sign up (mode=register)',
  })
  @Get('oauth/:provider')
  async oauthStart(
    @Param('provider') provider: string,
    @Query('tenantSlug') tenantSlug: string | undefined,
    @Query('mode') mode: string | undefined,
    @Res() res: Response,
  ) {
    if (!isOAuthProvider(provider)) throw new BadRequestException('Unknown provider');
    if (mode === 'register') return res.redirect(this.oauth.buildAuthorizeUrl(provider, { mode: 'register' }));
    if (!tenantSlug) throw new BadRequestException('tenantSlug is required');
    res.redirect(this.oauth.buildAuthorizeUrl(provider, { mode: 'login', tenantSlug }));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiParam({ name: 'provider', enum: Object.keys(OAUTH_PROVIDERS) })
  @ApiOperation({ summary: 'Social login callback: exchanges the code, then redirects back to the app' })
  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') providerError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    if (!isOAuthProvider(provider) || providerError) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Sign-in was cancelled or failed')}`);
    }
    let failPath = '/login';
    try {
      const { state: oauthState, email } = await this.oauth.resolveEmail(provider, code, state);
      const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
      failPath = oauthState.mode === 'register' ? '/register' : '/login';
      const result =
        oauthState.mode === 'register'
          ? await this.auth.socialRegister(provider, email, meta)
          : await this.auth.socialLogin(oauthState.tenantSlug, provider, email, meta);
      this.setRefreshCookie(res, result.refreshToken);
      // /admin bounces to /onboarding while the workspace's legal name is still unset.
      return res.redirect(`${frontendUrl}/admin`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      return res.redirect(`${frontendUrl}${failPath}?error=${encodeURIComponent(message)}`);
    }
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
