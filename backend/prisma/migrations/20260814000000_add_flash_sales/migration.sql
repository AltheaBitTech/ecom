-- CreateTable
CREATE TABLE "flash_sales" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sale_price_cents" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "flash_sales_window_check" CHECK ("ends_at" > "starts_at"),
    CONSTRAINT "flash_sales_price_check" CHECK ("sale_price_cents" >= 0),
    CONSTRAINT "flash_sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "flash_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "flash_sales_tenant_id_idx" ON "flash_sales"("tenant_id");
CREATE INDEX "flash_sales_tenant_id_starts_at_ends_at_idx" ON "flash_sales"("tenant_id", "starts_at", "ends_at");

-- Row-Level Security — same tenant-isolation policy every tenant-owned table uses.
ALTER TABLE "flash_sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flash_sales" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "flash_sales"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenant_id" = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenant_id" = current_setting('app.current_tenant', true)
  );
