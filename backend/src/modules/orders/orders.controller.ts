import { Body, Controller, Get, Header, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly invoices: InvoicesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  @ApiOperation({ summary: 'List orders for the caller\'s tenant', description: `Requires ${PERMISSIONS.ORDERS_VIEW}` })
  list(@CurrentUser() user: AuthContext, @Query() query: ListOrdersDto) {
    return this.orders.list(user.tenantId, query);
  }

  @Get('export')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export orders as CSV', description: `Requires ${PERMISSIONS.ORDERS_VIEW}. Honors the same filters as the list endpoint.` })
  async export(@CurrentUser() user: AuthContext, @Query() query: ListOrdersDto, @Res() res: Response) {
    const csv = await this.orders.exportCsv(user.tenantId, query);
    res.setHeader('Content-Disposition', `attachment; filename="orders.csv"`);
    res.send(csv);
  }

  @Get('public/:id')
  @Public()
  @ApiOperation({ summary: 'Customer-facing order lookup', description: 'Public. Requires the order id and the email it was placed under.' })
  findPublic(@Param('id') id: string, @Query('email') email: string) {
    return this.orders.findForCustomer(id, email);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_VIEW)
  @ApiOperation({ summary: 'Get an order', description: `Requires ${PERMISSIONS.ORDERS_VIEW}. Includes the status timeline and invoice, if any.` })
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.orders.findOne(user.tenantId, id);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Create an order', description: `Requires ${PERMISSIONS.ORDERS_MANAGE}. Snapshots each product's current price.` })
  async create(@CurrentUser() user: AuthContext, @Body() dto: CreateOrderDto) {
    const order = await this.orders.create(user.tenantId, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'order.create',
      resourceType: 'Order',
      resourceId: order.id,
      newValue: { customerId: order.customerId, totalCents: order.totalCents },
    });
    return order;
  }

  @Post(':id/confirm')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({
    summary: 'Confirm an order',
    description: `Requires ${PERMISSIONS.ORDERS_MANAGE}. Deducts stock for every line; rejected if any line is short.`,
  })
  async confirm(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    const order = await this.orders.confirm(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'order.confirm',
      resourceType: 'Order',
      resourceId: id,
    });
    return order;
  }

  @Post(':id/ship')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({
    summary: 'Mark an order shipped',
    description: `Requires ${PERMISSIONS.ORDERS_MANAGE}. trackingNumber/courierName are optional manual entry — no courier API is wired up yet.`,
  })
  async ship(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: ShipOrderDto) {
    const order = await this.orders.ship(user.tenantId, id, dto.trackingNumber, dto.courierName);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'order.ship',
      resourceType: 'Order',
      resourceId: id,
    });
    return order;
  }

  @Post(':id/fulfill')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Mark an order fulfilled', description: `Requires ${PERMISSIONS.ORDERS_MANAGE}. Also generates the invoice if one doesn't exist yet.` })
  async fulfill(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    const order = await this.orders.fulfill(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'order.fulfill',
      resourceType: 'Order',
      resourceId: id,
    });
    const invoice = await this.invoices.generateForOrder(user.tenantId, id);
    return { ...order, invoice };
  }

  @Post(':id/cancel')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({
    summary: 'Cancel an order',
    description: `Requires ${PERMISSIONS.ORDERS_MANAGE}. Restocks any deducted stock if the order was confirmed or shipped. An optional reason is recorded on the timeline and sent to the customer.`,
  })
  async cancel(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    const order = await this.orders.cancel(user.tenantId, id, dto.reason);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'order.cancel',
      resourceType: 'Order',
      resourceId: id,
      newValue: dto.reason ? { reason: dto.reason } : undefined,
    });
    return order;
  }
}
