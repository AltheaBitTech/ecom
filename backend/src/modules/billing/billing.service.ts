import { Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * The single source of truth for plan-gated behaviour. Feature availability and
 * usage limits are DATA on the Plan row — read here and nowhere else. There are
 * no plan-name conditionals (`if plan === 'pro'`) anywhere in the codebase;
 * callers ask `hasFeature()` / `assertWithinLimit()` and stay ignorant of tiers.
 */
export interface ResolvedEntitlements {
  planKey: string;
  planName: string;
  features: Record<string, boolean>;
  limits: Record<string, number>; // -1 = unlimited
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a tenant's plan into a flat feature/limit view. */
  async entitlements(tenantId: string): Promise<ResolvedEntitlements> {
    const subscription = await this.prisma.forTenant(tenantId, (tx) =>
      tx.subscription.findUnique({ where: { tenantId } }),
    );
    // Fall back to the free tier when a tenant has no subscription row yet.
    const planKey = subscription?.planKey ?? 'starter';
    const plan = await this.prisma.plan.findUnique({ where: { key: planKey } });
    if (!plan) {
      throw new AppException('plan_missing', `Plan "${planKey}" is not configured`, 500);
    }
    return {
      planKey: plan.key,
      planName: plan.name,
      features: (plan.features as Record<string, boolean>) ?? {},
      limits: (plan.limits as Record<string, number>) ?? {},
    };
  }

  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const { features } = await this.entitlements(tenantId);
    return features[feature] === true;
  }

  async assertFeature(tenantId: string, feature: string): Promise<void> {
    if (!(await this.hasFeature(tenantId, feature))) {
      throw AppException.featureNotInPlan(`Your plan does not include "${feature}"`);
    }
  }

  /** The numeric ceiling for a metered resource (-1 = unlimited). */
  async limitFor(tenantId: string, key: string): Promise<number> {
    const { limits } = await this.entitlements(tenantId);
    return typeof limits[key] === 'number' ? limits[key] : 0;
  }

  /** Throw plan_limit_exceeded if adding `wouldAdd` breaches the resource cap. */
  async assertWithinLimit(tenantId: string, key: string, currentCount: number, wouldAdd = 1): Promise<void> {
    const limit = await this.limitFor(tenantId, key);
    if (limit === -1) return; // unlimited
    if (currentCount + wouldAdd > limit) {
      throw AppException.limitExceeded(
        `Your plan allows ${limit} ${key}; you have ${currentCount}. Upgrade to add more.`,
      );
    }
  }
}
