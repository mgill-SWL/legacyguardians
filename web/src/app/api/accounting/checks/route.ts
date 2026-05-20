import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

function parseAmountCents(raw: string) {
  const cleaned = String(raw || "")
    .replace(/[$,\s]/g, "")
    .trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function isDigits(s: string) {
  return /^[0-9]+$/.test(s);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { email } });
  if (!actor?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: actor.activeFirmId, userId: actor.id } } });
  if (!canBookkeep({ userRole: actor.role, memberKind: member?.kind, memberRole: member?.role })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        financialAccountId?: string;
        checkNumber?: string;
        issueDate?: string; // YYYY-MM-DD
        payeeName?: string;
        amountUsd?: string;
        memo?: string | null;
      }
    | null;

  const financialAccountId = String(body?.financialAccountId || "").trim();
  const checkNumber = String(body?.checkNumber || "").trim();
  const issueDate = String(body?.issueDate || "").trim();
  const payeeName = String(body?.payeeName || "").trim();
  const memo = body?.memo ? String(body.memo) : null;
  const toBePrinted = body && Object.prototype.hasOwnProperty.call(body, "toBePrinted") ? !!(body as { toBePrinted?: unknown }).toBePrinted : true;

  if (!financialAccountId) return NextResponse.json({ ok: false, error: "financialAccountId required" }, { status: 400 });
  if (!toBePrinted && !checkNumber) return NextResponse.json({ ok: false, error: "checkNumber required" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return NextResponse.json({ ok: false, error: "issueDate must be YYYY-MM-DD" }, { status: 400 });
  if (!payeeName) return NextResponse.json({ ok: false, error: "payeeName required" }, { status: 400 });

  const amountCents = parseAmountCents(String(body?.amountUsd || ""));
  if (!amountCents) return NextResponse.json({ ok: false, error: "invalid amountUsd" }, { status: 400 });

  const account = await prisma.financialAccount.findFirst({ where: { id: financialAccountId, firmId: actor.activeFirmId, active: true } });
  if (!account) return NextResponse.json({ ok: false, error: "bank account not found" }, { status: 404 });

  // Create the check.
  try {
    await prisma.operatingCheck.create({
      data: {
        firmId: actor.activeFirmId,
        financialAccountId,
        status: "ISSUED",
        checkNumber: toBePrinted ? null : checkNumber,
        issueDate: new Date(`${issueDate}T00:00:00.000Z`),
        payeeName,
        amountCents,
        memo,
        toBePrinted,
        createdByUserId: actor.id,
      },
    });
  } catch {
    // Unique constraint on (financialAccountId, checkNumber)
    return NextResponse.json({ ok: false, error: "Duplicate check number for this account" }, { status: 409 });
  }

  // Update the per-account sequence to be at least (checkNumber + 1) when checkNumber is numeric.
  if (!toBePrinted && isDigits(checkNumber)) {
    const proposedNext = Number(checkNumber) + 1;
    const existingSeq = await prisma.financialAccountCheckSequence.findUnique({ where: { financialAccountId } });
    if (!existingSeq) {
      await prisma.financialAccountCheckSequence.create({
        data: { firmId: actor.activeFirmId, financialAccountId, nextNumber: proposedNext },
      });
    } else if (proposedNext > existingSeq.nextNumber) {
      await prisma.financialAccountCheckSequence.update({
        where: { id: existingSeq.id },
        data: { nextNumber: proposedNext },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
