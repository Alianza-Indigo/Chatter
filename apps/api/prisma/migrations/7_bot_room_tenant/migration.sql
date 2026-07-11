CREATE TABLE IF NOT EXISTS "BotRoomTenant" (
    "roomId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'sender_membership',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotRoomTenant_pkey" PRIMARY KEY ("roomId")
);

CREATE INDEX IF NOT EXISTS "BotRoomTenant_tenantId_idx" ON "BotRoomTenant"("tenantId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BotRoomTenant_tenantId_fkey'
    ) THEN
        ALTER TABLE "BotRoomTenant"
            ADD CONSTRAINT "BotRoomTenant_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
