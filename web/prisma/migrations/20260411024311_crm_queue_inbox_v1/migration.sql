-- CreateEnum
CREATE TYPE "ContactState" AS ENUM ('VA', 'DC', 'MD', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CrmTaskType" AS ENUM ('PRE_SHOW', 'POST_SHOW', 'RESCUE_CLICK', 'INBOUND_REPLY', 'REFERRAL_OOJ');

-- CreateEnum
CREATE TYPE "CrmPriority" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "CrmOwnerTeam" AS ENUM ('PH', 'US');

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "CrmDisposition" AS ENUM ('SCHEDULED_DISCOVERY', 'INTERESTED_FOLLOW_UP', 'NOT_INTERESTED', 'NO_ANSWER_RETRY', 'LEFT_VOICEMAIL', 'WRONG_NUMBER', 'DISQUALIFIED_JURISDICTION', 'REFERRED_TO_OVERTURE', 'BOOKING_LINK_SENT');

-- CreateEnum
CREATE TYPE "CrmProvider" AS ENUM ('RINGCENTRAL');

-- CreateEnum
CREATE TYPE "CrmMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CrmMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phoneE164" TEXT NOT NULL,
    "state" "ContactState" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCampaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultSenderName" TEXT NOT NULL DEFAULT 'Noah',
    "bookingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmShowing" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmShowing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmRegistration" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "showingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "watchToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "showingId" TEXT,
    "type" "CrmTaskType" NOT NULL,
    "priority" "CrmPriority" NOT NULL,
    "ownerTeam" "CrmOwnerTeam" NOT NULL,
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastTouchAt" TIMESTAMP(3),
    "disposition" "CrmDisposition",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmMessageThread" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "provider" "CrmProvider" NOT NULL,
    "providerConversationId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmMessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "CrmMessageDirection" NOT NULL,
    "fromNumberE164" TEXT NOT NULL,
    "toNumberE164" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "CrmMessageStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_phoneE164_key" ON "CrmContact"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "CrmCampaign_slug_key" ON "CrmCampaign"("slug");

-- CreateIndex
CREATE INDEX "CrmShowing_campaignId_idx" ON "CrmShowing"("campaignId");

-- CreateIndex
CREATE INDEX "CrmShowing_startsAt_idx" ON "CrmShowing"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmRegistration_watchToken_key" ON "CrmRegistration"("watchToken");

-- CreateIndex
CREATE INDEX "CrmRegistration_campaignId_idx" ON "CrmRegistration"("campaignId");

-- CreateIndex
CREATE INDEX "CrmRegistration_showingId_idx" ON "CrmRegistration"("showingId");

-- CreateIndex
CREATE INDEX "CrmRegistration_contactId_idx" ON "CrmRegistration"("contactId");

-- CreateIndex
CREATE INDEX "CrmTask_status_dueAt_idx" ON "CrmTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "CrmTask_campaignId_idx" ON "CrmTask"("campaignId");

-- CreateIndex
CREATE INDEX "CrmTask_contactId_idx" ON "CrmTask"("contactId");

-- CreateIndex
CREATE INDEX "CrmMessageThread_contactId_idx" ON "CrmMessageThread"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmMessage_providerMessageId_key" ON "CrmMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "CrmMessage_threadId_createdAt_idx" ON "CrmMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "CrmShowing" ADD CONSTRAINT "CrmShowing_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRegistration" ADD CONSTRAINT "CrmRegistration_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRegistration" ADD CONSTRAINT "CrmRegistration_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRegistration" ADD CONSTRAINT "CrmRegistration_showingId_fkey" FOREIGN KEY ("showingId") REFERENCES "CrmShowing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_showingId_fkey" FOREIGN KEY ("showingId") REFERENCES "CrmShowing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmMessageThread" ADD CONSTRAINT "CrmMessageThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CrmMessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
