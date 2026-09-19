/**
 * One-time bootstrap for the first platform (cross-tenant super-admin) account — there is
 * no public registration for this role by design. Run once via:
 *   PLATFORM_ADMIN_EMAIL=you@example.com PLATFORM_ADMIN_PASSWORD='...' pnpm seed:platform-admin
 * Idempotent: re-running with the same email updates that admin's password instead of erroring.
 */
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD in the environment.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('PLATFORM_ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const passwordHash = await argon2.hash(password);
  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
  console.log(`Platform admin ready: ${admin.email} (${admin.id})`);
  await prisma.$disconnect();
}

main();
