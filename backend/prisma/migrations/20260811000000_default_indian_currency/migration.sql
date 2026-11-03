ALTER TABLE "tenant_settings" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "tenant_settings" ALTER COLUMN "locale" SET DEFAULT 'en-IN';
ALTER TABLE "plans" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'INR';

-- This application is India-only; normalize existing development data too.
UPDATE "tenant_settings" SET "currency" = 'INR', "locale" = 'en-IN' WHERE "currency" = 'USD';
UPDATE "plans" SET "currency" = 'INR' WHERE "currency" = 'USD';
UPDATE "products" SET "currency" = 'INR' WHERE "currency" = 'USD';
UPDATE "orders" SET "currency" = 'INR' WHERE "currency" = 'USD';
UPDATE "payments" SET "currency" = 'INR' WHERE "currency" = 'USD';
