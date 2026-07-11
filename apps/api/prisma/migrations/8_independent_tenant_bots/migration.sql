UPDATE "Tenant"
SET "botUserId" = '@whalabi-bot-' || regexp_replace(slug, '[^a-z0-9_-]', '-', 'g') || ':' || "matrixServerName";

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_botUserId_key" ON "Tenant"("botUserId");
