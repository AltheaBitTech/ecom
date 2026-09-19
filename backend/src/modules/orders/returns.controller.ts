import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { RequestReturnDto } from './dto/request-return.dto';
import { ResolveReturnDto } from './dto/resolve-return.dto';
import { ReturnsService } from './returns.service';

@ApiTags('returns')
@Controller('orders')
export class ReturnsController {
  constructor(
    private readonly returns: ReturnsService,
    private readonly audit: AuditService,
  ) {}

  @Post('public/:id/returns')
  @Public()
  @ApiOperation({ summary: 'Request a return on an order', description: 'Public. Proves ownership via the email the order was placed under, same as the public order lookup.' })
  request(@Param('id') id: string, @Body() dto: RequestReturnDto) {
    return this.returns.request(id, dto.email, dto.reason);
  }

  @Get('returns')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  @ApiOperation({ summary: 'List return requests for the tenant', description: `Requires ${PERMISSIONS.ORDERS_VIEW}` })
  list(@CurrentUser() user: AuthContext, @Query('orderId') orderId?: string) {
    return this.returns.list(user.tenantId, orderId);
  }

  @Patch('returns/:id')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Approve, reject, or refund a return request', description: `Requires ${PERMISSIONS.ORDERS_MANAGE}` })
  async resolve(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: ResolveReturnDto) {
    const result = await this.returns.resolve(user.tenantId, id, dto.status, dto.refundCents, dto.adminNote);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: `return.${dto.status.toLowerCase()}`,
      resourceType: 'ReturnRequest',
      resourceId: id,
    });
    return result;
  }
}
