-- Add explicit, queryable merchandising fields. Existing rows keep current behavior.
ALTER TABLE "categories"
  ADD COLUMN "description" VARCHAR(500),
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "products"
  ADD COLUMN "compare_at_price_cents" INTEGER,
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_bestseller" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "badge" VARCHAR(32);

ALTER TABLE "products"
  ADD CONSTRAINT "products_compare_at_price_cents_check"
  CHECK ("compare_at_price_cents" IS NULL OR "compare_at_price_cents" >= 0);

CREATE INDEX "categories_tenant_id_is_featured_position_idx"
  ON "categories"("tenant_id", "is_featured", "position");

CREATE INDEX "products_tenant_id_is_featured_status_idx"
  ON "products"("tenant_id", "is_featured", "status");

CREATE INDEX "products_tenant_id_is_bestseller_status_idx"
  ON "products"("tenant_id", "is_bestseller", "status");
