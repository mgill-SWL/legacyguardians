-- Task management foundation: firm-scoped tasks, optional matter link, creator/assignee, deadline, and 10-point progress.
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Task_completionPercent_check" CHECK ("completionPercent" >= 0 AND "completionPercent" <= 100 AND "completionPercent" % 10 = 0)
);

CREATE INDEX "Task_firmId_completionPercent_deadline_idx" ON "Task"("firmId", "completionPercent", "deadline");
CREATE INDEX "Task_firmId_assigneeUserId_completionPercent_deadline_idx" ON "Task"("firmId", "assigneeUserId", "completionPercent", "deadline");
CREATE INDEX "Task_matterId_completionPercent_deadline_idx" ON "Task"("matterId", "completionPercent", "deadline");
CREATE INDEX "Task_createdByUserId_idx" ON "Task"("createdByUserId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
