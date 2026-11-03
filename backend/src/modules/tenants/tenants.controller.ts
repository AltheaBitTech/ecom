import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth, Internal, Public, RequirePermission } from '../../common/auth/decorators';

import { ProvisionTenantDto, SaveStoreDesignDto, SetAttributeSchemaDto, UpdateSettingsDto } from './dto/tenants.dto';
import { TenantsService } from './tenants.service';

/** Onboarding — trusted server-to-server (internal API key) only. */
@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly tenants: TenantsService) {}

  @Post('provision')
  @Internal()
  provision(@Body() dto: ProvisionTenantDto) {
    return this.tenants.provision(dto);
  }
}

/** Store configuration — staff, gated by store_settings permissions. */
@ApiTags('tenants')
@Controller('tenants/:tenantId')
@Auth('staff', 'internal')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermission('store_settings:read')
  get(@Param('tenantId') tenantId: string) {
    return this.tenants.getTenant(tenantId);
  }

  @Get('settings')
  @RequirePermission('store_settings:read')
  getSettings(@Param('tenantId') tenantId: string) {
    return this.tenants.getSettings(tenantId);
  }

  @Patch('settings')
  @RequirePermission('store_settings:write')
  updateSettings(@Param('tenantId') tenantId: string, @Body() dto: UpdateSettingsDto) {
    return this.tenants.updateSettings(tenantId, dto);
  }

  @Get('design')
  @RequirePermission('store_settings:read')
  getDesign(@Param('tenantId') tenantId: string) {
    return this.tenants.getDesign(tenantId);
  }

  @Put('design/draft')
  @RequirePermission('store_settings:write')
  saveDesignDraft(@Param('tenantId') tenantId: string, @Body() dto: SaveStoreDesignDto) {
    return this.tenants.saveDesignDraft(tenantId, dto);
  }

  @Post('design/preview')
  @RequirePermission('store_settings:read')
  createDesignPreview(@Param('tenantId') tenantId: string) {
    return this.tenants.createDesignPreview(tenantId);
  }

  @Post('design/publish')
  @RequirePermission('store_settings:write')
  publishDesign(@Param('tenantId') tenantId: string) {
    return this.tenants.publishDesign(tenantId);
  }

  @Get('design/templates')
  @RequirePermission('store_settings:read')
  listDesignTemplates(@Param('tenantId') tenantId: string) {
    return this.tenants.listDesignTemplates(tenantId);
  }

  @Put('settings/attribute-schema')
  @RequirePermission('store_settings:write')
  setAttributeSchema(@Param('tenantId') tenantId: string, @Body() dto: SetAttributeSchemaDto) {
    return this.tenants.setAttributeSchema(tenantId, dto);
  }
}

/** Public storefront config — theme + attribute schema for rendering. */
@ApiTags('storefront')
@Controller('storefront/:tenantId')
export class StorefrontConfigController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('config')
  @Public()
  config(@Param('tenantId') tenantId: string, @Query('preview_token') previewToken?: string) {
    return this.tenants.getStorefrontSettings(tenantId, previewToken);
  }
}

/**
 * Public subdomain → store resolver. Lets the storefront and admin sign-in turn a
 * human-friendly slug (the store's subdomain) into the opaque tenant id needed by
 * every other route. Returns only already-public fields; no credential required.
 */
@ApiTags('storefront')
@Controller('stores')
export class PublicStoreController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('lookup')
  @Public()
  lookup(@Query('slug') slug: string) {
    return this.tenants.resolveBySlug(slug ?? '');
  }
}
