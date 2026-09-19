ALTER TABLE "Tenant" ADD COLUMN "storefront" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Product" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Other', ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "compareAtCents" INTEGER;
ALTER TABLE "Product" ADD CONSTRAINT "Product_compareAt_check" CHECK ("compareAtCents" IS NULL OR "compareAtCents" > "priceCents");
ALTER TABLE "ProductVariant" ADD COLUMN "compareAtCents" INTEGER;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "Variant_compareAt_check" CHECK ("compareAtCents" IS NULL OR "compareAtCents" > "priceCents");
ALTER TABLE "Order" ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "shippingCents" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "couponCode" TEXT, ADD COLUMN "delivery" JSONB;
UPDATE "Order" SET "subtotalCents" = "totalCents";
CREATE TABLE "Coupon" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "code" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "kind" TEXT NOT NULL,
 "value" INTEGER NOT NULL, "minimumCents" INTEGER NOT NULL DEFAULT 0, "maximumDiscountCents" INTEGER,
 "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Coupon_rules_check" CHECK ("kind" IN ('percent', 'fixed') AND "value" > 0 AND ("kind" <> 'percent' OR "value" <= 100) AND "minimumCents" >= 0 AND ("maximumDiscountCents" IS NULL OR "maximumDiscountCents" > 0) AND "endsAt" > "startsAt")
);
CREATE UNIQUE INDEX "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");
CREATE INDEX "Coupon_tenantId_active_endsAt_idx" ON "Coupon"("tenantId", "active", "endsAt");
CREATE TABLE "Review" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "displayName" TEXT NOT NULL, "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5), "body" TEXT NOT NULL,
 "published" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Review_orderId_productId_key" ON "Review"("orderId", "productId");
CREATE INDEX "Review_tenantId_published_createdAt_idx" ON "Review"("tenantId", "published", "createdAt");
