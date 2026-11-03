// Dev fixture: a fully-populated grocery storefront on the "greenbasket" theme
// so you can SEE the GreenBasket design render from admin data — 8 departments,
// ~48 ACTIVE products, offer cards, "why shop" strip, and a manual payment
// account so checkout completes without a live gateway.
//
// Prereq — provision the tenant + owner login first (real auth/RBAC):
//   curl -X POST http://localhost:4001/v1/onboarding/provision \
//     -H 'Content-Type: application/json' -H 'X-Internal-Key: <ECOM_INTERNAL_KEY>' \
//     -d '{"name":"GreenBasket","slug":"greenbasket",
//          "owner_email":"owner@greenbasket.test","owner_password":"FreshGreens12345"}'
// Run:  DIRECT_URL=... node scripts/seed-greenbasket-demo.js
// Then: admin at /admin/sign-in; storefront at /greenbasket
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const SLUG = 'greenbasket';

// Mirrors createDefaultDesign('greenbasket') + the template's section data from
// frontend store-templates.ts. Kept inline (backend JS can't import the TS module).
// If the template changes, update both. ponytail: duplicated theme literal.
const THEME = {
  schemaVersion: 1,
  templateId: 'greenbasket',
  tokens: {
    colors: { primary: '#2e9e4b', primaryForeground: '#ffffff', background: '#f4f8f0', accent: '#cdeeb4' },
    headingFont: 'friendly', bodyFont: 'sans', radius: 'large', density: 'compact',
  },
  global: {
    logoMediaId: null,
    announcement: '🚚 Free Delivery on Orders Over ₹499 · 10% OFF your first order — code WELCOME10',
    tagline: 'Fresh choices, healthy life — daily essentials delivered to your doorstep.',
    navigation: [], footer: { heading: 'GreenBasket', body: 'Your trusted online grocery store for a healthier, happier you.' }, socialLinks: [],
  },
  sections: [
    { id: 'hero', type: 'hero', enabled: true, variant: 'market', data: { title: 'Fresh Groceries Delivered to', accent: 'Your Doorstep' } },
    { id: 'categories', type: 'category-rail', enabled: true, variant: 'tiles', data: { title: 'Shop by category' } },
    { id: 'promos', type: 'promotion-mosaic', enabled: true, variant: 'trio', data: { cards: [
      { eyebrow: 'Fresh From Farm to Table', title: 'UP TO 25% OFF', cta: 'Shop Now', href: '/#collection', tint: '#e7f3dd' },
      { eyebrow: 'Stock Up & Save on Daily Essentials', title: 'UP TO 30% OFF', cta: 'Shop Now', href: '/#collection', tint: '#fdf0d8' },
      { eyebrow: 'Exclusive Deals This Week', title: 'UP TO 40% OFF', cta: 'Shop Now', href: '/#collection', tint: '#ece5f6' },
    ] } },
    { id: 'featured', type: 'product-collection', enabled: true, variant: 'market', data: { title: 'Featured Products', source: 'featured' } },
    { id: 'trust', type: 'trust-bar', enabled: true, variant: 'inline', data: { title: 'Why Shop With Us?', items: [
      { icon: '✓', title: 'Best Quality', body: 'We provide only the best quality' },
      { icon: '₹', title: 'Affordable Prices', body: 'Best deals & offers everyday' },
      { icon: '⚡', title: 'Fast Delivery', body: 'On time, at your doorstep' },
      { icon: '🔒', title: 'Secure Payments', body: 'Multiple secure payment options' },
      { icon: '☎', title: '24/7 Support', body: 'We are always here to help' },
    ] } },
    { id: 'collection', type: 'product-collection', enabled: true, variant: 'catalog', data: { title: 'Shop all', source: 'all' } },
    { id: 'newsletter', type: 'newsletter', enabled: true, variant: 'split', data: { title: 'Get the Best Offers Straight to Your Inbox!', body: 'Subscribe to our newsletter & get 10% OFF on your first order.' } },
  ],
};

// 8 departments. [name, priceRupees, weightLabel] per product.
const CATALOG = {
  'Fruits & Vegetables': [['Fresh Red Apple', 349, '1kg'], ['Organic Bananas', 249, '1 dozen'], ['Tomatoes', 40, '1kg'], ['Baby Spinach', 60, '250g'], ['Green Capsicum', 80, '500g'], ['Carrots', 55, '1kg']],
  'Dairy & Eggs': [['Milk Full Cream', 199, '1 litre'], ['Farm Fresh Eggs', 299, '12 pcs'], ['Amul Butter', 265, '500g'], ['Greek Yogurt', 90, '400g'], ['Paneer', 320, '500g'], ['Cheese Slices', 140, '200g']],
  'Breakfast & Snacks': [['Corn Flakes', 210, '500g'], ['Peanut Butter', 320, '1kg'], ['Oats', 180, '1kg'], ['Digestive Biscuits', 60, '250g'], ['Honey', 260, '500g'], ['Muesli', 340, '750g']],
  Beverages: [['Cold Brew Coffee', 180, '250ml'], ['Green Tea', 250, '100 bags'], ['Orange Juice', 120, '1 litre'], ['Sparkling Water', 90, '750ml'], ['Instant Coffee', 310, '200g'], ['Coconut Water', 45, '200ml']],
  'Grocery & Staples': [['Basmati Rice', 1299, '5kg'], ['Sunflower Oil', 399, '1 litre'], ['Toor Dal', 180, '1kg'], ['Wheat Flour', 240, '5kg'], ['Sugar', 55, '1kg'], ['Iodized Salt', 25, '1kg']],
  'Personal Care': [['Herbal Shampoo', 220, '340ml'], ['Bath Soap', 45, '100g'], ['Toothpaste', 95, '150g'], ['Face Wash', 175, '150ml'], ['Hand Sanitizer', 80, '250ml'], ['Body Lotion', 210, '400ml']],
  'Household Care': [['Dishwash Liquid', 199, '750ml'], ['Floor Cleaner', 185, '1 litre'], ['Laundry Detergent', 340, '2kg'], ['Toilet Cleaner', 95, '500ml'], ['Garbage Bags', 120, '30 pcs'], ['Air Freshener', 150, '200ml']],
  'Baby Care': [['Baby Diapers', 599, '46 pcs'], ['Baby Wipes', 199, '72 pcs'], ['Baby Lotion', 245, '200ml'], ['Baby Shampoo', 210, '200ml'], ['Baby Cereal', 175, '300g'], ['Baby Powder', 160, '200g']],
};

const toSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("select set_config('app.bypass_rls','on',true)");

    const tenant = await tx.tenant.findUnique({ where: { slug: SLUG } });
    if (!tenant) throw new Error(`Tenant '${SLUG}' not found — provision it first (see header).`);
    const TENANT = tenant.id;

    await tx.tenantSettings.upsert({
      where: { tenantId: TENANT },
      update: { storeName: 'GreenBasket', currency: 'INR', locale: 'en-IN', theme: THEME, draftTheme: THEME },
      create: { tenantId: TENANT, storeName: 'GreenBasket', currency: 'INR', locale: 'en-IN', theme: THEME, draftTheme: THEME },
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
        ? await tx.category.update({ where: { id: existing.id }, data: { name: catName, position, isFeatured: true } })
        : await tx.category.create({ data: { tenantId: TENANT, name: catName, slug: catSlug, position, isFeatured: true } });
      position += 1;

      for (const [name, rupees, weight] of items) {
        const slug = toSlug(name);
        const priceCents = rupees * 100;
        const image = `https://picsum.photos/seed/${slug}/600/600`;
        // Every 4th item gets a compare-at price so the "Sale" badge shows.
        const onSale = n % 4 === 0;
        await tx.product.upsert({
          where: { tenantId_slug: { tenantId: TENANT, slug } },
          update: { status: 'ACTIVE', priceCents, categoryId: category.id },
          create: {
            tenantId: TENANT, slug, name,
            description: `${name} (${weight}) — fresh and delivered to your door by GreenBasket.`,
            status: 'ACTIVE', priceCents, currency: 'INR', stock: 60,
            compareAtPriceCents: onSale ? Math.round(priceCents * 1.25) : null,
            isFeatured: n % 6 === 0, isBestseller: n % 5 === 0,
            categoryId: category.id, images: [image],
            customAttributes: { weight },
          },
        });
        n += 1;
      }
    }

    const count = await tx.product.count({ where: { tenantId: TENANT, status: 'ACTIVE' } });
    console.log(`seeded '${SLUG}': ${Object.keys(CATALOG).length} departments, ${count} active products, greenbasket theme, manual payments`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
