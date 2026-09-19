import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { AuditService } from '../../common/auth/audit.service';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { StorefrontService } from './storefront.service';

@ApiTags('storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService, private readonly audit: AuditService) {}
  @Get() @Public()
  home(@Headers('x-store-slug') store?: string) { return this.storefront.home(undefined, store); }
  @Get('products') @Public()
  listProducts(@Headers('x-store-slug') store?: string) { return this.storefront.listProducts(undefined, store); }
  @Post('quote') @Public()
  quote(@Body() body: unknown, @Headers('x-store-slug') store?: string) { return this.storefront.quote(body, undefined, store); }
  @Post('checkout') @Public()
  checkout(@Body() body: unknown, @Headers('x-store-slug') store?: string) { return this.storefront.checkout(body, store); }
  @Post('verify-payment') @Public()
  verify(@Body() body: unknown, @Headers('x-store-slug') store?: string) { return this.storefront.verifyPayment(body, store); }
  @Post('reviews') @Public()
  review(@Body() body: unknown, @Headers('x-store-slug') store?: string) { return this.storefront.submitReview(body, store); }

  @Get('admin/preview') @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_VIEW)
  preview(@CurrentUser() user: AuthContext) { return this.storefront.home(user.tenantId); }
  @Post('admin/quote') @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_VIEW)
  previewQuote(@CurrentUser() user: AuthContext, @Body() body: unknown) { return this.storefront.quote(body, user.tenantId); }
  @Get('admin') @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_VIEW)
  admin(@CurrentUser() user: AuthContext) { return this.storefront.administration(user.tenantId); }
  @Get('admin/analytics') @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  analytics(@CurrentUser() user: AuthContext) { return this.storefront.analytics(user.tenantId); }
  @Patch('admin/settings') @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  async settings(@CurrentUser() user: AuthContext, @Body() body: unknown) {
    const result = await this.storefront.saveSettings(user.tenantId, body);
    await this.record(user, 'storefront.settings.update', user.tenantId);
    return result;
  }
  @Post('admin/offers') @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  async offer(@CurrentUser() user: AuthContext, @Body() body: unknown) {
    const result = await this.storefront.saveCoupon(user.tenantId, undefined, body);
    await this.record(user, 'storefront.offer.create', result.id);
    return result;
  }
  @Patch('admin/offers/:id') @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  async editOffer(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    const result = await this.storefront.saveCoupon(user.tenantId, id, body);
    await this.record(user, 'storefront.offer.update', id);
    return result;
  }
  @Patch('admin/reviews/:id') @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  async moderate(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() body: unknown) {
    const result = await this.storefront.moderateReview(user.tenantId, id, body);
    await this.record(user, 'storefront.review.moderate', id);
    return result;
  }
  private record(user: AuthContext, action: string, resourceId: string) {
    return this.audit.log({ tenantId: user.tenantId, actorId: user.userId, actorEmail: user.email, action, resourceType: 'Storefront', resourceId });
  }
}
