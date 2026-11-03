import { Injectable } from '@nestjs/common';
import { Customer } from '@prisma/client';

import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

import { CustomerAuthService, CustomerTokenResult } from './customer-auth.service';
import { UpdateProfileDto, UpsertAddressDto } from './dto/customers.dto';

/** Metadata carried from the HTTP request into session issuance/rotation. */
export interface RequestMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/** The shopper profile ecom exposes — the local Customer row, snake_cased. */
export interface ProfileView {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  email_verified: boolean;
  status: string;
  created_at: string;
}

export interface AddressView {
  id: string;
  label: string | null;
  full_name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  is_default: boolean;
}

interface AddressRow {
  id: string;
  label: string | null;
  fullName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

/**
 * Shopper accounts. Identity (credentials, tokens, verification) is handled
 * natively by CustomerAuthService against ecom's own Customer table — ecom mints
 * and verifies its own tokens. This service adds the commerce-side profile view
 * and the address book on top of that identity.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: CustomerAuthService,
  ) {}

  // --- auth ------------------------------------------------------------------

  signup(tenantId: string, input: { email: string; password: string; name?: string; phone?: string }) {
    return this.auth.signup(tenantId, input);
  }

  login(tenantId: string, input: { email: string; password: string }, meta: RequestMeta): Promise<CustomerTokenResult> {
    return this.auth.login(tenantId, input, meta);
  }

  refresh(refreshToken: string, meta: RequestMeta): Promise<CustomerTokenResult> {
    return this.auth.refresh(refreshToken, meta);
  }

  logout(refreshToken: string): Promise<void> {
    return this.auth.logout(refreshToken);
  }

  verifyEmail(token: string) {
    return this.auth.verifyEmail(token);
  }

  resendVerification(tenantId: string, email: string) {
    return this.auth.resendVerification(tenantId, email);
  }

  // --- profile ---------------------------------------------------------------

  async getProfile(tenantId: string, customerId: string): Promise<ProfileView> {
    const customer = await this.prisma.forTenant(tenantId, (tx) =>
      tx.customer.findFirst({ where: { id: customerId, deletedAt: null } }),
    );
    if (!customer) throw AppException.notFound('Profile not found');
    return this.toProfile(customer);
  }

  async updateProfile(tenantId: string, customerId: string, dto: UpdateProfileDto): Promise<ProfileView> {
    const customer = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null } });
      if (!existing) throw AppException.notFound('Profile not found');
      return tx.customer.update({ where: { id: customerId }, data: { name: dto.name } });
    });
    return this.toProfile(customer);
  }

  // --- address book ----------------------------------------------------------

  async listAddresses(tenantId: string, customerId: string): Promise<AddressView[]> {
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.customerAddress.findMany({
        where: { customerId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
    );
    return rows.map((r) => this.toAddress(r));
  }

  async createAddress(tenantId: string, customerId: string, dto: UpsertAddressDto): Promise<AddressView> {
    const row = await this.prisma.forTenant(tenantId, async (tx) => {
      const count = await tx.customerAddress.count({ where: { customerId } });
      // First address is the default; otherwise honour the explicit flag.
      const makeDefault = count === 0 || dto.is_default === true;
      if (makeDefault) {
        await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({
        data: { tenantId, customerId, ...this.toRow(dto), isDefault: makeDefault },
      });
    });
    return this.toAddress(row);
  }

  async updateAddress(
    tenantId: string,
    customerId: string,
    id: string,
    dto: UpsertAddressDto,
  ): Promise<AddressView> {
    const row = await this.prisma.forTenant(tenantId, async (tx) => {
      // Ownership: the row must belong to THIS customer, not just this tenant.
      const existing = await tx.customerAddress.findFirst({ where: { id, customerId } });
      if (!existing) throw AppException.notFound('Address not found');

      const makeDefault = dto.is_default === true || existing.isDefault;
      if (makeDefault && !existing.isDefault) {
        await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      }
      return tx.customerAddress.update({
        where: { id },
        data: { ...this.toRow(dto), isDefault: makeDefault },
      });
    });
    return this.toAddress(row);
  }

  async deleteAddress(tenantId: string, customerId: string, id: string): Promise<void> {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.customerAddress.findFirst({ where: { id, customerId } });
      if (!existing) throw AppException.notFound('Address not found');
      await tx.customerAddress.delete({ where: { id } });

      // If we removed the default, promote the next-oldest so the shopper always
      // has a usable default at checkout.
      if (existing.isDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }

  async setDefaultAddress(tenantId: string, customerId: string, id: string): Promise<AddressView> {
    const row = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.customerAddress.findFirst({ where: { id, customerId } });
      if (!existing) throw AppException.notFound('Address not found');
      await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      return tx.customerAddress.update({ where: { id }, data: { isDefault: true } });
    });
    return this.toAddress(row);
  }

  // --- mapping ---------------------------------------------------------------

  private toProfile(r: Customer): ProfileView {
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      phone: r.phone,
      email_verified: r.emailVerified,
      status: r.status,
      created_at: r.createdAt.toISOString(),
    };
  }

  private toRow(dto: UpsertAddressDto) {
    return {
      label: dto.label ?? null,
      fullName: dto.full_name,
      phone: dto.phone ?? null,
      line1: dto.line1,
      line2: dto.line2 ?? null,
      city: dto.city,
      state: dto.state ?? null,
      postalCode: dto.postal_code,
      country: dto.country.toUpperCase(),
    };
  }

  private toAddress(r: AddressRow): AddressView {
    return {
      id: r.id,
      label: r.label,
      full_name: r.fullName,
      phone: r.phone,
      line1: r.line1,
      line2: r.line2,
      city: r.city,
      state: r.state,
      postal_code: r.postalCode,
      country: r.country,
      is_default: r.isDefault,
    };
  }
}
