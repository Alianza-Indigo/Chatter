-- Índice de membresía: a qué organización pertenece cada usuario (MXID).
-- organizationId NULL = espacio Global. Lo consulta el módulo de aislamiento
-- de Synapse para permitir/bloquear el contacto entre organizaciones.

CREATE TABLE IF NOT EXISTS "OrgMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgMembership_userId_key" ON "OrgMembership"("userId");
CREATE INDEX IF NOT EXISTS "OrgMembership_organizationId_idx" ON "OrgMembership"("organizationId");

ALTER TABLE "OrgMembership"
    ADD CONSTRAINT "OrgMembership_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
