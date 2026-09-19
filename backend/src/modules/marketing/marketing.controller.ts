import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { AudiencePreviewDto } from './dto/audience-preview.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { MarketingService } from './marketing.service';

@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(
    private readonly marketing: MarketingService,
    private readonly audit: AuditService,
  ) {}

  @Get('campaigns')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.MARKETING_VIEW)
  @ApiOperation({ summary: 'Campaign history', description: `Requires ${PERMISSIONS.MARKETING_VIEW}` })
  list(@CurrentUser() user: AuthContext) {
    return this.marketing.list(user.tenantId);
  }

  @Post('campaigns/preview')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.MARKETING_VIEW)
  @ApiOperation({ summary: 'How many opted-in customers a campaign would reach', description: 'Read-only; sends nothing.' })
  preview(@CurrentUser() user: AuthContext, @Body() dto: AudiencePreviewDto) {
    return this.marketing.audiencePreview(user.tenantId, dto.audience, dto.customerIds ?? [], dto.channels);
  }

  @Post('campaigns')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.MARKETING_SEND)
  @ApiOperation({
    summary: 'Send a broadcast over email/SMS/WhatsApp',
    description: `Requires ${PERMISSIONS.MARKETING_SEND}. Only ever reaches customers who opted in at checkout and have not unsubscribed. Delivery runs in the background; poll the campaign row for counts.`,
  })
  async send(@CurrentUser() user: AuthContext, @Body() body: unknown) {
    const campaign = await this.marketing.send(user.tenantId, body, user.email);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'marketing.campaign.send',
      resourceType: 'Campaign',
      resourceId: campaign.id,
      newValue: { subject: campaign.subject, channels: campaign.channels, audience: campaign.audience, recipients: campaign.recipientCount },
    });
    return campaign;
  }

  @Get('unsubscribe')
  @Public()
  @ApiOperation({ summary: 'Unsubscribe from marketing', description: 'Public. Authorised by the HMAC token in the link, so it works from an email client with no login.' })
  unsubscribe(@Query() dto: UnsubscribeDto) {
    return this.marketing.unsubscribe(dto.c, dto.t);
  }
}
