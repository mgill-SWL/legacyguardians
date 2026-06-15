import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { portalCookieName, verifyPortalSession } from "@/lib/portalSession";

export async function requirePortalSession() {
  const jar = await cookies();
  const session = verifyPortalSession(jar.get(portalCookieName())?.value);
  if (!session) return null;
  return session;
}

export async function portalCanAccessMatter(opts: { matterId: string; email: string }) {
  const m = await prisma.matter.findUnique({
    where: { id: opts.matterId },
    select: { id: true, intake: { select: { data: true } } },
  });
  if (!m?.intake?.data) return { ok: false as const, matter: null };

  const d = m.intake.data as { clientEmails?: { client1?: unknown; client2?: unknown } };
  const e1 = String(d?.clientEmails?.client1 || "").toLowerCase().trim();
  const e2 = String(d?.clientEmails?.client2 || "").toLowerCase().trim();
  const email = opts.email.toLowerCase().trim();
  if (e1 !== email && e2 !== email) return { ok: false as const, matter: null };
  return { ok: true as const, matter: m };
}

