/**
 * Idempotent seed for a handful of example subscription plans — Plan is platform-admin
 * managed today with no CRUD UI yet, so this script is the only way to seed them.
 * ponytail: fixed set of 3 example plans, not a config file — add a real Plan admin UI
 * before this needs to grow past "a few example tiers".
 *   pnpm seed:plans
 */
import { PrismaClient } from '@prisma/client';

const PLANS = [
  { name: 'Starter', priceCents: 99900, currency: 'INR', intervalDays: 30, features: ['Up to 100 orders/mo', 'Email support'] },
  { name: 'Growth', priceCents: 299900, currency: 'INR', intervalDays: 30, features: ['Unlimited orders', 'Priority support', 'Referral program'] },
  { name: 'Scale', priceCents: 799900, currency: 'INR', intervalDays: 30, features: ['Unlimited orders', 'Dedicated support', 'Custom integrations'] },
];

async function main() {
  const prisma = new PrismaClient();
  for (const plan of PLANS) {
    const row = await prisma.plan.upsert({ where: { name: plan.name }, create: plan, update: plan });
    console.log(`Plan ready: ${row.name} (${row.id})`);
  }
  await prisma.$disconnect();
}

main();
