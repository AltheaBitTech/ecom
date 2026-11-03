// Dev fixture: a fully-populated demo store so you can SEE the storefront
// render from data — a new "onboarded" bakery tenant on the bakery-artisan
// theme, 5 categories, 50 ACTIVE products, and a manual payment account so
// checkout completes without a live gateway.
//
// Prereq — provision the tenant + owner login first (real auth/RBAC):
//   curl -X POST http://localhost:4001/v1/onboarding/provision \
//     -H 'Content-Type: application/json' -H 'X-Internal-Key: <ECOM_INTERNAL_KEY>' \
//     -d '{"name":"Sweet Crumb Bakehouse","slug":"sweet-crumb",
//          "owner_email":"owner@sweetcrumb.test","owner_password":"BakeFresh12345"}'
// Run:  DIRECT_URL=... node scripts/seed-bakery-demo.js
// Then: log into admin at /admin/sign-in with that email/password; storefront at /sweet-crumb
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const SLUG = 'sweet-crumb';

// Mirrors createDefaultDesign('bakery-artisan') from frontend store-templates.ts.
// Kept inline (not imported) — this is a backend JS script; the frontend TS
// module isn't reachable here. If the template's tokens change, update both.
// ponytail: duplicated theme literal, dedupe only if a shared JSON export appears.
const section = (id, type, variant, data) => ({ id, type, enabled: true, variant, data });
const THEME = {
  schemaVersion: 1,
  templateId: 'bakery-artisan',
  tokens: {
    colors: { primary: '#8a4b2f', primaryForeground: '#fff7ec', background: '#f7ecd9', accent: '#e6a94f' },
    headingFont: 'editorial', bodyFont: 'modern', radius: 'pill', density: 'airy',
  },
  global: {
    logoMediaId: null,
    announcement: 'Fresh from the oven every morning — free delivery over ₹499',
    tagline: 'Slow-fermented breads, hand-finished cakes, and small-batch treats.',
    navigation: [], footer: { heading: 'Sweet Crumb Bakehouse', body: 'Baked fresh daily since 2019.' }, socialLinks: [],
  },
  sections: [
    section('hero', 'hero', 'spotlight', { title: 'BAKED FRESH.', accent: 'EVERY MORNING.' }),
    section('categories', 'category-rail', 'line', { title: 'Shop by category' }),
    section('featured', 'product-collection', 'menu', { title: "Today's bakes", source: 'featured' }),
    section('promotion', 'promotion-split', 'spotlight', { eyebrow: 'From our ovens', title: 'A better way to shop', body: 'Considered products, clear prices, and delivery that works around you.' }),
    section('collection', 'product-collection', 'catalog', { title: 'Shop all', source: 'all' }),
    section('trust', 'trust-bar', 'inline', {}),
    section('newsletter', 'newsletter', 'split', { title: 'Good things, delivered.', body: 'New bakes and private offers, occasionally.' }),
  ],
};

// 5 categories × 10 products = 50. [name, priceRupees] per product.
const CATALOG = {
  Breads: [['Sourdough Boule', 220], ['Whole Wheat Loaf', 160], ['Multigrain Batard', 240], ['Focaccia Rosemary', 260], ['Baguette', 90], ['Ciabatta', 140], ['Milk Bread', 120], ['Rye Loaf', 250], ['Garlic Bread', 130], ['Brioche Loaf', 280]],
  'Cakes & Pastries': [['Dark Chocolate Truffle', 650], ['Red Velvet Slice', 180], ['Butter Croissant', 90], ['Pain au Chocolat', 110], ['Cheesecake Slice', 220], ['Fresh Fruit Tart', 240], ['Carrot Cake', 190], ['Eclair', 130], ['Danish Pastry', 120], ['Lemon Drizzle Cake', 200]],
  'Cookies & Biscuits': [['Chocolate Chip Cookie', 60], ['Oatmeal Raisin Cookie', 55], ['Almond Biscotti', 140], ['Shortbread Box', 260], ['Double Chocolate Cookie', 70], ['Coconut Macaroon', 80], ['Butter Nankhatai', 120], ['Ginger Snap', 65], ['Peanut Butter Cookie', 75], ['Jam Thumbprint', 85]],
  'Savory & Snacks': [['Veg Puff', 45], ['Chicken Quiche', 160], ['Cheese Straws', 120], ['Spinach Roll', 90], ['Sausage Roll', 110], ['Paneer Kulcha', 100], ['Mushroom Vol-au-vent', 150], ['Masala Bun', 50], ['Corn & Cheese Slice', 130], ['Pretzel', 95]],
  Beverages: [['Cold Brew Coffee', 180], ['Masala Chai', 60], ['Hot Chocolate', 150], ['Iced Latte', 190], ['Fresh Lemonade', 90], ['Berry Smoothie', 210], ['Cappuccino', 140], ['Green Tea', 70], ['Mango Shake', 160], ['Filter Coffee', 80]],
};

const toSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("select set_config('app.bypass_rls','on',true)");

    // Tenant + owner login must already exist via the provisioning flow (real
    // argon2 + RBAC wiring). This script only layers on theme + catalog.
    const tenant = await tx.tenant.findUnique({ where: { slug: SLUG } });
    if (!tenant) throw new Error(`Tenant '${SLUG}' not found — provision it first (see header).`);
    const TENANT = tenant.id;

    await tx.tenantSettings.upsert({
      where: { tenantId: TENANT },
      update: { storeName: 'Sweet Crumb Bakehouse', currency: 'INR', locale: 'en-IN', theme: THEME, draftTheme: THEME },
      create: { tenantId: TENANT, storeName: 'Sweet Crumb Bakehouse', currency: 'INR', locale: 'en-IN', theme: THEME, draftTheme: THEME },
    });

    await tx.paymentAccount.upsert({
      where: { tenantId: TENANT },
      update: { provider: 'manual', enabled: true },
      create: { tenantId: TENANT, provider: 'manual', enabled: true },
    });

    let position = 0, n = 0;
    for (const [catName, items] of Object.entries(CATALOG)) {
      const catSlug = toSlug(catName);
      const existing = await tx.category.findFirst({ where: { tenantId: TENANT, slug: catSlug } });
      const category = existing
        ? await tx.category.update({ where: { id: existing.id }, data: { name: catName, position, isFeatured: position < 3 } })
        : await tx.category.create({ data: { tenantId: TENANT, name: catName, slug: catSlug, position, isFeatured: position < 3 } });
      position += 1;

      for (const [name, rupees] of items) {
        const slug = toSlug(name);
        const priceCents = rupees * 100;
        const image = `https://picsum.photos/seed/${slug}/600/600`;
        await tx.product.upsert({
          where: { tenantId_slug: { tenantId: TENANT, slug } },
          update: { status: 'ACTIVE', priceCents, categoryId: category.id },
          create: {
            tenantId: TENANT, slug, name,
            description: `${name} — baked fresh in small batches at Sweet Crumb.`,
            status: 'ACTIVE', priceCents, currency: 'INR', stock: 40,
            isFeatured: n % 7 === 0, isBestseller: n % 5 === 0,
            categoryId: category.id, images: [image],
            customAttributes: { weight: '250g', veg: !/chicken|sausage/i.test(name) },
          },
        });
        n += 1;
      }
    }

    const count = await tx.product.count({ where: { tenantId: TENANT, status: 'ACTIVE' } });
    console.log(`seeded '${SLUG}': ${Object.keys(CATALOG).length} categories, ${count} active products, bakery-artisan theme, manual payments`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
