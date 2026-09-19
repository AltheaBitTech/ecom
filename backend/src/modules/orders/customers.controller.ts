import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';

@ApiTags('customers')
@ApiBearerAuth('access-token')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORDERS_CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'List customers for the caller\'s tenant', description: `Requires ${PERMISSIONS.ORDERS_CUSTOMERS_VIEW}` })
  list(@CurrentUser() user: AuthContext, @Query() query: ListCustomersDto) {
    return this.customers.list(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDERS_CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'Get a customer', description: `Requires ${PERMISSIONS.ORDERS_CUSTOMERS_VIEW}` })
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.customers.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORDERS_CUSTOMERS_MANAGE)
  @ApiOperation({ summary: 'Create a customer', description: `Requires ${PERMISSIONS.ORDERS_CUSTOMERS_MANAGE}` })
  async create(@CurrentUser() user: AuthContext, @Body() dto: CreateCustomerDto) {
    const customer = await this.customers.create(user.tenantId, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'customer.create',
      resourceType: 'Customer',
      resourceId: customer.id,
      newValue: { name: customer.name, email: customer.email },
    });
    return customer;
  }
}
