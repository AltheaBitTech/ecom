import { Body, Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Auth, Public, RequirePermission } from '../../common/auth/decorators';
import { CompleteMediaUploadDto, CreateMediaUploadDto } from './dto/media.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('tenants/:tenantId/media')
@Auth('staff', 'internal')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @RequirePermission('store_settings:read')
  list(@Param('tenantId') tenantId: string) { return this.media.list(tenantId); }

  @Post('uploads')
  @RequirePermission('store_settings:write')
  createUpload(@Param('tenantId') tenantId: string, @Body() dto: CreateMediaUploadDto) { return this.media.createUpload(tenantId, dto); }

  @Post(':id/complete')
  @RequirePermission('store_settings:write')
  complete(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: CompleteMediaUploadDto) { return this.media.complete(tenantId, id, dto); }

  @Delete(':id')
  @RequirePermission('store_settings:write')
  archive(@Param('tenantId') tenantId: string, @Param('id') id: string) { return this.media.archive(tenantId, id); }
}

@ApiTags('storefront')
@Controller('storefront/:tenantId/media')
export class StorefrontMediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  @Public()
  async deliver(@Param('tenantId') tenantId: string, @Param('id') id: string, @Res() response: Response) {
    response.redirect(302, await this.media.deliveryUrl(tenantId, id));
  }
}
