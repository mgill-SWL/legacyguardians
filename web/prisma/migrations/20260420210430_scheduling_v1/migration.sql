-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ScheduledJobType" AS ENUM ('SEND_EMAIL', 'SEND_SMS');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "AppointmentType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "startIntervalMin" INTEGER NOT NULL DEFAULT 15,
    "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "rollingWeeks" INTEGER NOT NULL DEFAULT 8,
    "maxPerDay" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentAssignee" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "displayName" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/New_York',
    "weekdayStartMin" INTEGER NOT NULL DEFAULT 540,
    "weekdayEndMin" INTEGER NOT NULL DEFAULT 1020,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "assignedGoogleEmail" TEXT NOT NULL,
    "googleEventId" TEXT,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "type" "ScheduledJobType" NOT NULL,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentType_slug_key" ON "AppointmentType"("slug");

-- CreateIndex
CREATE INDEX "AppointmentAssignee_typeId_enabled_idx" ON "AppointmentAssignee"("typeId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentAssignee_typeId_googleEmail_key" ON "AppointmentAssignee"("typeId", "googleEmail");

-- CreateIndex
CREATE INDEX "Appointment_typeId_startsAt_idx" ON "Appointment"("typeId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_assignedGoogleEmail_startsAt_idx" ON "Appointment"("assignedGoogleEmail", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduledJob_status_runAt_idx" ON "ScheduledJob"("status", "runAt");

-- AddForeignKey
ALTER TABLE "AppointmentAssignee" ADD CONSTRAINT "AppointmentAssignee_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AppointmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AppointmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
