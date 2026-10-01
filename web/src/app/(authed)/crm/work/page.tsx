import Link from "next/link";

import { prisma } from "@/lib/prisma";

import { QueueList, type QueueTask } from "../queue/QueueList";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function contactName(contact: { firstName: string; lastName: string; phoneE164: string }) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || contact.phoneE164;
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function CrmWorkPage() {
  const now = new Date();

  const [tasks, threads] = await Promise.all([
    prisma.crmTask.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lte: now } },
      orderBy: [{ dueAt: "asc" }],
      take: 50,
      include: { contact: true, campaign: true, showing: true },
    }),
    prisma.crmMessageThread.findMany({
      where: { provider: "RINGCENTRAL" },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 30,
      include: {
        contact: true,
        lead: { include: { campaign: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const serialized: QueueTask[] = tasks.map((task) => ({
    id: task.id,
    contactName: contactName(task.contact),
    phone: task.contact.phoneE164,
    type: task.type,
    campaignSlug: task.campaign.slug,
    ownerTeam: task.ownerTeam,
    showingLabel: task.showing ? formatDate(task.showing.startsAt) : null,
    priority: task.priority,
    status: task.status,
    disposition: task.disposition,
    dueAtISO: task.dueAt.toISOString(),
    lastTouchLabel: task.lastTouchAt ? formatDate(task.lastTouchAt) : null,
    notes: task.notes,
  }));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sw-muted)" }}>
            CRM / Work
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 820 }}>Operator workspace</h1>
          <p style={{ margin: "6px 0 0", color: "var(--sw-muted)" }}>
            Due tasks and inbox threads in one place — work the queue inline, jump into any thread to reply.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="sw-btn" href="/crm/queue">Full queue</Link>
          <Link className="sw-btn" href="/crm/inbox">Full inbox</Link>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", alignItems: "start" }}>
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 10px" }}>
            Task queue <span style={{ color: "var(--sw-muted)", fontWeight: 600 }}>({tasks.length} due)</span>
          </h2>
          <QueueList tasks={serialized} />
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 10px" }}>
            Inbox <span style={{ color: "var(--sw-muted)", fontWeight: 600 }}>({threads.length} threads)</span>
          </h2>
          {threads.length === 0 ? (
            <div style={{ color: "var(--sw-muted)" }}>No threads yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {threads.map((t) => {
                const last = t.messages[0];
                return (
                  <Link
                    key={t.id}
                    href={`/crm/inbox/${t.id}`}
                    style={{
                      border: "1px solid var(--sw-border)",
                      borderRadius: "var(--sw-radius)",
                      background: "var(--sw-card)",
                      padding: 12,
                      textDecoration: "none",
                      color: "inherit",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong>{contactName(t.contact)}</strong>
                      <span style={{ color: "var(--sw-muted)", fontSize: 12 }}>{t.contact.phoneE164}</span>
                    </div>
                    <div style={{ color: "var(--sw-muted)", fontSize: 13 }}>
                      {last ? `${label(last.direction)}: ${last.body.slice(0, 100)}` : "No messages yet"}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--sw-muted)" }}>
                      <span>{label(t.intakeResolutionStatus)}</span>
                      <span>· Match: {t.matchConfidence.toLowerCase()}</span>
                      {t.needsConflictCheck ? <span>· Conflict review needed</span> : null}
                      {t.lead ? <span>· Lead: {t.lead.campaign.name}</span> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
