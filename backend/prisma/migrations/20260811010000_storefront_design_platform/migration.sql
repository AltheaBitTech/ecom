CREATE TYPE "media_status" AS ENUM ('UPLOADING', 'READY', 'ARCHIVED');

ALTER TABLE "tenant_settings"
  ADD COLUMN "draft_theme" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "draft_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "published_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "published_at" TIMESTAMPTZ;

UPDATE "tenant_settings"
SET "draft_theme" = "theme", "draft_revision" = 1, "published_revision" = 1, "published_at" = NOW();

CREATE TABLE "media_assets" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "alt_text" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "status" "media_status" NOT NULL DEFAULT 'UPLOADING',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_assets_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760),
  CONSTRAINT "media_assets_dimensions_check" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)),
  CONSTRAINT "media_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");
CREATE INDEX "media_assets_tenant_id_status_created_at_idx" ON "media_assets"("tenant_id", "status", "created_at");

ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "media_assets"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenant_id" = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenant_id" = current_setting('app.current_tenant', true)
  );

UPDATE "plans"
SET "features" = "features" || CASE
  WHEN "key" = 'starter' THEN '{"premiumStorefrontTemplates":false,"exclusiveStorefrontTemplates":false}'::jsonb
  WHEN "key" = 'pro' THEN '{"premiumStorefrontTemplates":true,"exclusiveStorefrontTemplates":false}'::jsonb
  ELSE '{"premiumStorefrontTemplates":true,"exclusiveStorefrontTemplates":true}'::jsonb
END,
"limits" = "limits" || CASE
  WHEN "key" = 'starter' THEN '{"mediaBytes":262144000}'::jsonb
  WHEN "key" = 'pro' THEN '{"mediaBytes":5368709120}'::jsonb
  ELSE '{"mediaBytes":26843545600}'::jsonb
END
WHERE "key" IN ('starter', 'pro', 'enterprise');
