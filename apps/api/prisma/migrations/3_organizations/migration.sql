-- Multitenant híbrido: organizaciones por "código de organización".
-- Cada organización es un Espacio Matrix; el Espacio "Global" vive en Tenant.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "globalSpaceId" TEXT;

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_tenantId_code_key" ON "Organization"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "Organization_tenantId_idx" ON "Organization"("tenantId");

ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
