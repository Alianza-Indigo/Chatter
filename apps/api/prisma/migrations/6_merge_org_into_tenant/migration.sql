-- Fusión: la "Organización" es el Tenant. Se le mueve el código y el espacio,
-- la membresía pasa a referenciar al tenant y se elimina el modelo Organization.

-- 1) Tenant gana código y espacio; publicDomain se vuelve opcional (ya no único).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "spaceId" TEXT;
ALTER TABLE "Tenant" DROP CONSTRAINT IF EXISTS "Tenant_publicDomain_key";
ALTER TABLE "Tenant" ALTER COLUMN "publicDomain" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_code_key" ON "Tenant"("code");

-- Conserva el espacio general que ya existiera (columna globalSpaceId de la 3).
UPDATE "Tenant" SET "spaceId" = "globalSpaceId"
  WHERE "spaceId" IS NULL AND "globalSpaceId" IS NOT NULL;
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "globalSpaceId";

-- 2) La membresía referencia al tenant (organización); se quita organizationId.
ALTER TABLE "OrgMembership" DROP CONSTRAINT IF EXISTS "OrgMembership_organizationId_fkey";
DROP INDEX IF EXISTS "OrgMembership_organizationId_idx";
ALTER TABLE "OrgMembership" DROP COLUMN IF EXISTS "organizationId";
CREATE INDEX IF NOT EXISTS "OrgMembership_tenantId_idx" ON "OrgMembership"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrgMembership_tenantId_fkey'
  ) THEN
    ALTER TABLE "OrgMembership"
      ADD CONSTRAINT "OrgMembership_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Se elimina el modelo Organization (su rol lo cumple ahora el Tenant).
DROP TABLE IF EXISTS "Organization";
