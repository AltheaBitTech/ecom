// Dev fixture: give the Acme tenant a browsable storefront so the frontend
// (#28) can be verified end to end — store settings, a manual payment account
// (so guest checkout completes without a live gateway), and two ACTIVE products.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const TENANT = 'cmsdk1m04000e13ky8eri2l26';

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("select set_config('app.bypass_rls','on',true)");

    await tx.tenantSettings.upsert({
      where: { tenantId: TENANT },
      update: { storeName: 'Acme Store', currency: 'INR', locale: 'en' },
      create: {
        tenantId: TENANT,
        storeName: 'Acme Store',
        currency: 'INR',
        locale: 'en',
        theme: { colors: { primary: '#4f46e5', primaryForeground: '#ffffff' } },
      },
    });

    await tx.paymentAccount.upsert({
      where: { tenantId: TENANT },
      update: { provider: 'manual', enabled: true },
      create: { tenantId: TENANT, provider: 'manual', enabled: true },
    });

    const products = [
      { slug: 'aurora-lamp', name: 'Aurora Desk Lamp', priceCents: 249000, stock: 25, attrs: { material: 'Aluminium', warranty: '2 years' } },
      { slug: 'nimbus-bottle', name: 'Nimbus Water Bottle', priceCents: 89000, stock: 100, attrs: { capacity: '750ml', color: 'Slate' } },
    ];
    for (const p of products) {
      await tx.product.upsert({
        where: { tenantId_slug: { tenantId: TENANT, slug: p.slug } },
        update: { status: 'ACTIVE', priceCents: p.priceCents, stock: p.stock, currency: 'INR' },
        create: {
          tenantId: TENANT,
          slug: p.slug,
          name: p.name,
          description: `${p.name} — a dependable everyday pick.`,
          status: 'ACTIVE',
          priceCents: p.priceCents,
          currency: 'INR',
          stock: p.stock,
          customAttributes: p.attrs,
        },
      });
    }

    const count = await tx.product.count({ where: { tenantId: TENANT, status: 'ACTIVE' } });
    console.log(`seeded store settings + manual payments + products (active products: ${count})`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
