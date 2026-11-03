import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { Auth, CurrentPrincipal, Public } from '../../common/auth/decorators';
import { isCustomer, type Principal } from '../../common/auth/principal';
import { AppConfig } from '../../common/config/app-config';
import { AppException } from '../../common/errors/app-exception';

import {
  clearCustomerRefreshCookie,
  readCustomerRefreshCookie,
  setCustomerRefreshCookie,
} from './customer-cookie';
import { CustomersService } from './customers.service';
import {
  CustomerLoginDto,
  CustomerSignupDto,
  ResendVerificationDto,
  UpdateProfileDto,
  UpsertAddressDto,
  VerifyEmailDto,
} from './dto/customers.dto';

/** Pull the user-agent + client IP off the request for session bookkeeping. */
function metaOf(req: Request): { userAgent: string | null; ipAddress: string | null } {
  return { userAgent: req.headers['user-agent'] ?? null, ipAddress: req.ip ?? null };
}

/**
 * Storefront shopper auth, served natively by ecom. Credentials are hashed and
 * verified against ecom's own Customer table; the refresh token lives in an
 * httpOnly cookie. All routes are @Public — the shopper's own credentials (or
 * the refresh cookie) authenticate them.
 */
@ApiTags('storefront-account-auth')
@Controller('storefront/:tenantId/account/auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class CustomerAuthController {
  constructor(
    private readonly customers: CustomersService,
    private readonly config: AppConfig,
  ) {}

  @Post('signup')
  @Public()
  signup(@Param('tenantId') tenantId: string, @Body() dto: CustomerSignupDto) {
    return this.customers.signup(tenantId, dto);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(
    @Param('tenantId') tenantId: string,
    @Body() dto: CustomerLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, refreshToken } = await this.customers.login(tenantId, dto, metaOf(req));
    if (refreshToken) setCustomerRefreshCookie(res, refreshToken, tenantId, this.config);
    return tokens;
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  async refresh(
    @Param('tenantId') tenantId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const current = readCustomerRefreshCookie(req);
    if (!current) throw AppException.unauthenticated('No active session');
    const { tokens, refreshToken } = await this.customers.refresh(current, metaOf(req));
    if (refreshToken) setCustomerRefreshCookie(res, refreshToken, tenantId, this.config);
    return tokens;
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  async logout(
    @Param('tenantId') tenantId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const current = readCustomerRefreshCookie(req);
    if (current) await this.customers.logout(current);
    clearCustomerRefreshCookie(res, tenantId, this.config);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(200)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.customers.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(202)
  async resendVerification(
    @Param('tenantId') tenantId: string,
    @Body() dto: ResendVerificationDto,
  ): Promise<{ status: 'accepted' }> {
    await this.customers.resendVerification(tenantId, dto.email);
    return { status: 'accepted' };
  }
}

/**
 * A signed-in shopper's own profile and address book. `@Auth('customer')` binds
 * every route to a verified customer token; the customer id comes from that
 * token (never a path/body), so a shopper can only ever act on their own data.
 */
@ApiTags('storefront-account')
@Controller('storefront/:tenantId/account')
@Auth('customer')
export class CustomerProfileController {
  constructor(private readonly customers: CustomersService) {}

  @Get('profile')
  getProfile(@Param('tenantId') tenantId: string, @CurrentPrincipal() principal: Principal) {
    const customer = this.customerOf(principal, tenantId);
    return this.customers.getProfile(tenantId, customer.customerId);
  }

  @Patch('profile')
  updateProfile(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateProfileDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    const customer = this.customerOf(principal, tenantId);
    return this.customers.updateProfile(tenantId, customer.customerId, dto);
  }

  @Get('addresses')
  listAddresses(@Param('tenantId') tenantId: string, @CurrentPrincipal() principal: Principal) {
    const customer = this.customerOf(principal, tenantId);
    return this.customers.listAddresses(tenantId, customer.customerId);
  }

  @Post('addresses')
  createAddress(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertAddressDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    const customer = this.customerOf(principal, tenantId);
    return this.customers.createAddress(tenantId, customer.customerId, dto);
  }

  @Put('addresses/:id')
  updateAddress(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpsertAddressDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    const customer = this.customerOf(principal, tenantId);
    return this.customers.updateAddress(tenantId, customer.customerId, id, dto);
  }

  @Post('addresses/:id/default')
  @HttpCode(200)
  setDefaultAddress(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    const customer = this.customerOf(principal, tenantId);
    return this.customers.setDefaultAddress(tenantId, customer.customerId, id);
  }

  @Delete('addresses/:id')
  @HttpCode(204)
  async deleteAddress(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    const customer = this.customerOf(principal, tenantId);
    await this.customers.deleteAddress(tenantId, customer.customerId, id);
  }

  /**
   * The token must be a customer, and its tenant must match the store in the
   * path — a customer token minted for another store cannot reach across.
   */
  private customerOf(principal: Principal, tenantId: string) {
    if (!isCustomer(principal)) throw AppException.permissionDenied();
    if (principal.tenantId !== tenantId) throw AppException.tenantBoundary();
    return principal;
  }
}
