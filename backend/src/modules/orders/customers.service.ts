import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { ListCustomersDto } from './dto/list-customers.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListCustomersDto = {}) {
    const { search, sortBy = 'createdAt', sortDir = 'desc' } = query;
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    return this.prisma.forTenant(tenantId).customer.findMany({ where, orderBy: { [sortBy]: sortDir } });
  }

  async findOne(tenantId: string, customerId: string) {
    const customer = await this.prisma.forTenant(tenantId).customer.findFirst({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  create(tenantId: string, dto: CreateCustomerDto) {
    return this.prisma.forTenant(tenantId).customer.create({ data: { tenantId, ...dto } });
  }
}
