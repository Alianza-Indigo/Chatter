-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('openai', 'ollama', 'dummy');

-- CreateEnum
CREATE TYPE "BotResponseMode" AS ENUM ('mention', 'dm', 'always');

-- CreateEnum
CREATE TYPE "BotLogStatus" AS ENUM ('received', 'ignored', 'processing', 'responded', 'rate_limited', 'error');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publicDomain" TEXT NOT NULL,
    "matrixBaseUrl" TEXT NOT NULL,
    "matrixServerName" TEXT NOT NULL,
    "botUserId" TEXT,
    "botEnabled" BOOLEAN NOT NULL DEFAULT false,
    "botSystemPrompt" TEXT,
    "botResponseMode" "BotResponseMode" NOT NULL DEFAULT 'mention',
    "llmProvider" "LlmProvider" NOT NULL DEFAULT 'dummy',
    "llmModel" TEXT,
    "llmBaseUrl" TEXT,
    "llmApiKey" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "accentColor" TEXT NOT NULL DEFAULT '#a78bfa',
    "logoUrl" TEXT,
    "tagline" TEXT,
    "allowRegistration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "eventId" TEXT,
    "userId" TEXT,
    "status" "BotLogStatus" NOT NULL,
    "content" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_publicDomain_key" ON "Tenant"("publicDomain");

-- CreateIndex
CREATE INDEX "Tenant_publicDomain_idx" ON "Tenant"("publicDomain");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "BotLog_tenantId_createdAt_idx" ON "BotLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "BotLog_roomId_idx" ON "BotLog"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_userId_idx" ON "PushSubscription"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "BotLog" ADD CONSTRAINT "BotLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

