import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { Auth, CurrentPrincipal, Public } from '../../common/auth/decorators';
import { isStaff, type Principal } from '../../common/auth/principal';
import { AppConfig } from '../../common/config/app-config';
import { AppException } from '../../common/errors/app-exception';
import { AuthService } from '../auth/auth.service';

import { StaffLoginDto } from './dto/admin.dto';
import {
  clearStaffRefreshCookie,
  readStaffRefreshCookie,
  setStaffRefreshCookie,
} from './staff-cookie';

/** Pull the user-agent + client IP off the request for session bookkeeping. */
function metaOf(req: Request): { userAgent: string | null; ipAddress: string | null } {
  return { userAgent: req.headers['user-agent'] ?? null, ipAddress: req.ip ?? null };
}

/**
 * Staff (merchant admin) sign-in, served natively by ecom's own AuthService.
 * Credentials are verified against ecom's User table (argon2 + pepper), MFA is
 * gated before any token is minted, and the rotated refresh token lives in an
 * httpOnly cookie. The auth routes are @Public (the staff member's own
 * credentials authenticate them); `me` requires a verified staff token.
 */
@ApiTags('admin-auth')
@Controller('admin/:tenantId/auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AdminAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(
    @Param('tenantId') tenantId: string,
    @Body() dto: StaffLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { result, refreshToken } = await this.auth.login(tenantId, dto.email, dto.password, metaOf(req));
    // A refresh token only comes back on full success (not the MFA challenge step).
    if (refreshToken) setStaffRefreshCookie(res, refreshToken, tenantId, this.config);
    return result;
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  async refresh(
    @Param('tenantId') tenantId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const current = readStaffRefreshCookie(req);
    if (!current) throw AppException.unauthenticated('No active session');
    const { result, refreshToken } = await this.auth.refresh(current, metaOf(req));
    if (refreshToken) setStaffRefreshCookie(res, refreshToken, tenantId, this.config);
    return result;
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  async logout(
    @Param('tenantId') tenantId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const current = readStaffRefreshCookie(req);
    if (current) await this.auth.logout(current);
    clearStaffRefreshCookie(res, tenantId, this.config);
  }

  @Get('me')
  @Auth('staff')
  me(@Param('tenantId') tenantId: string, @CurrentPrincipal() principal: Principal) {
    if (!isStaff(principal)) throw AppException.permissionDenied();
    if (principal.tenantId !== tenantId) throw AppException.tenantBoundary();
    return {
      user_id: principal.userId,
      tenant_id: principal.tenantId,
      role: principal.role,
      permissions: principal.permissions,
    };
  }
}
