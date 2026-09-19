import { Controller, Get, Header, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth('access-token')
@Controller('orders')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly audit: AuditService,
  ) {}

  @Get(':id/invoice')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  @ApiOperation({ summary: 'Get an order\'s invoice', description: `Requires ${PERMISSIONS.ORDERS_VIEW}` })
  get(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.invoices.findByOrder(user.tenantId, id);
  }

  @Get(':id/invoice/pdf')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: "Download an order's invoice as a PDF", description: `Requires ${PERMISSIONS.ORDERS_VIEW}` })
  async getPdf(@CurrentUser() user: AuthContext, @Param('id') id: string, @Res() res: Response) {
    const invoice = await this.invoices.findByOrder(user.tenantId, id);
    const pdf = await this.invoices.renderPdf(user.tenantId, id);
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.number}.pdf"`);
    res.send(pdf);
  }

  @Get('public/:id/invoice/pdf')
  @Public()
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: "Customer-facing invoice PDF download", description: 'Public. Requires the order id and the email it was placed under.' })
  async getPdfPublic(@Param('id') id: string, @Query('email') email: string, @Res() res: Response) {
    const { pdf, number } = await this.invoices.renderPdfForCustomer(id, email);
    res.setHeader('Content-Disposition', `attachment; filename="${number}.pdf"`);
    res.send(pdf);
  }

  @Post(':id/invoice')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({
    summary: 'Generate an order\'s invoice on demand',
    description: `Requires ${PERMISSIONS.ORDERS_MANAGE}. Idempotent — returns the existing invoice if one was already generated (e.g. on fulfillment).`,
  })
  async generate(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    const invoice = await this.invoices.generateForOrder(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'invoice.generate',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      newValue: { orderId: id, number: invoice.number },
    });
    return invoice;
  }
}
