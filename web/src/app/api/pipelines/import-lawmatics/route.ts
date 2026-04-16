import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const LAW_MATICS = [
  {
    name: "Intake Pipeline",
    stages: [
      "Initial contact",
      "Discovery Call Scheduled",
      "Discovery Call - No Answer",
      "Discovery Call Held - Client Fee Quote Sent",
      "Attorney Welcome Call Scheduled",
      "Attorney Welcome Call Missed",
      "Welcome Call Held - Thinking About It - Email Follow Up Sent",
      "Priority Follow Up",
      "Discovery and Welcome Call Held - Thinking About It",
      "Needs Case Assessment by Attorney",
      "Case Assessment Sent",
      "PAC Scheduled",
    ],
  },
  {
    name: "Estate Planning Representation Pipeline",
    stages: [
      "Design Meeting Booked",
      "Client Fee Quote Signed",
      "EPIS received",
      "Design Meeting Missed",
      "Design Meeting Held - Not Retained",
      "Representation Agreement Pending",
      "Representation Agreement Signed",
      "Waiting on client homework",
      "EPP Drafting",
      "SCI Delivered, Document Tour Pending",
      "Doc Tour Complete - Signing Ceremony Scheduled",
      "Deed Recording / Follow Up Needed",
      "Representation Completed",
      "Doc Tour Rescheduled",
      "Document Tour Missed",
      "Doc Tour Complete - Signing Ceremony Not Booked",
    ],
  },
  {
    name: "EA Probate Representation Pipeline (Fiduciary)",
    stages: [
      "Representation Agreement Pending",
      "Representation Agreement signed/received",
      "Voyage of Discovery Underway",
      "Voyage of Discovery Completed, No Qualification Necessary",
      "Voyage of Discovery Completed, Preparing for Qualification",
      "Qualification Pending",
      "Qualification - Follow Up Required",
      "Notice of Probate Pending",
      "Inventory - Not Submitted",
      "Inventory - Submitted, Pending Approval",
      "Inventory Approved",
      "Statement in Lieu Pending",
      "Interim Meeting Held",
      "Accounting Due",
      "Accounting/SIL - Submitted, Pending Approval",
      "Accounting - Exceptions Received",
      "Accounting - Approved",
      "Matter Ongoing Beyond First Account",
      "Matter Complete",
    ],
  },
  {
    name: "Estate Planning Revision Pipeline",
    stages: [
      "Revision Consultation Booked",
      "Representation Agreement Pending",
      "Representation Agreement Signed",
      "Revision Consultation Held",
      "Revision Consultation Missed",
      "Waiting on Client Homework",
      "Drafting",
      "Draft Documents Delivered",
      "Follow Up Needed",
      "Document Tour/Client Review Complete",
      "Representation Completed",
    ],
  },
  {
    // Per Misha: "One Off Matters" should just be Deeds.
    name: "Deeds",
    stages: [
      "New Matter",
      "Documents Received",
      "Payment Received",
      "Paid Attorney Consultation Booked",
      "Representation Agreement Pending",
      "Representation Agreement Signed",
      "Drafting",
      "Follow Up Needed",
      "Representation Complete",
    ],
  },
  {
    name: "EA Beneficiary Representation Pipeline",
    stages: [
      "Initial Consultation Pending",
      "Demand Letter Drafting and Voyage of Discovery",
      "Opposing Party Response Pending",
      "Negotiations Underway",
      "Prepare Pleadings",
      "In Litigation",
      "Matter Complete",
    ],
  },
  {
    name: "Trust Administration Pipeline",
    stages: [
      "Representation Agreement Pending",
      "Representation Agreement Signed/Received",
      "Voyage of Discovery Underway",
      "Voyage of Discovery Completed – Preparing for Trustee Certification",
      "Trustee Qualification Pending",
      "Trustee Qualification – Follow Up Required",
      "Notice to Beneficiaries Pending",
      "Trust Asset Inventory – Not Submitted",
      "Trust Asset Inventory – Submitted, Pending Attorney Review",
      "Trust Asset Inventory – Approved",
      "Interim Distributions/Meetings Due",
      "Accounting Due",
      "Accounting – Submitted, Pending Review",
      "Accounting – Exceptions or Revisions Required",
      "Accounting – Approved and Delivered",
      "Final Distribution Pending",
      "Refunding Bonds Pending",
      "Receipts & Releases Received, Final Distribution Pending",
      "Matter Complete",
    ],
  },
] as const;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (user.role !== "ADMIN") {
    // Bootstrap: if no admins exist yet, promote the first real user who attempts an admin action.
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount === 0) {
      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    } else {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  // If an old pipeline exists, rename it.
  const old = await prisma.pipeline.findFirst({ where: { name: "One-Off Matters" } });
  if (old) {
    await prisma.pipeline.update({ where: { id: old.id }, data: { name: "Deeds" } });
  }

  const existingPipelines = await prisma.pipeline.findMany({
    include: { stages: true },
  });
  const byName = new Map(existingPipelines.map((p) => [p.name, p] as const));

  for (let pIdx = 0; pIdx < LAW_MATICS.length; pIdx++) {
    const def = LAW_MATICS[pIdx];

    const pipeline = byName.get(def.name)
      ? await prisma.pipeline.update({ where: { id: byName.get(def.name)!.id }, data: { sortOrder: pIdx } })
      : await prisma.pipeline.create({ data: { name: def.name, sortOrder: pIdx } });

    const stages = await prisma.pipelineStage.findMany({ where: { pipelineId: pipeline.id } });
    const stageByName = new Map(stages.map((s) => [s.name, s] as const));

    for (let sIdx = 0; sIdx < def.stages.length; sIdx++) {
      const stageName = def.stages[sIdx];
      const existing = stageByName.get(stageName);
      if (existing) {
        if (existing.sortOrder !== sIdx) {
          await prisma.pipelineStage.update({ where: { id: existing.id }, data: { sortOrder: sIdx } });
        }
      } else {
        await prisma.pipelineStage.create({ data: { pipelineId: pipeline.id, name: stageName, sortOrder: sIdx } });
      }
    }
  }

  return NextResponse.json({ ok: true, imported: LAW_MATICS.length });
}
