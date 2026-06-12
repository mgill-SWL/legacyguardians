import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { PipelineFieldsForm } from "./PipelineFieldsForm";
import { TimeEntriesCard } from "./TimeEntriesCard";
import { MatterLocationForm } from "./MatterLocationForm";
import { BillingCard } from "./BillingCard";
import { TimelineCard } from "./TimelineCard";
import { MatterFieldsCard } from "./MatterFieldsCard";
import GeneratePacketButton from "./GeneratePacketButton";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const email = session.user.email;
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  const { matterId } = await params;
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: { intake: true },
  });

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });

  const locations = user?.activeFirmId
    ? await prisma.firmLocation.findMany({
        where: { firmId: user.activeFirmId, active: true },
        select: { id: true, name: true, slug: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    : [];

  const allFirmLocations = user?.activeFirmId
    ? await prisma.firmLocation.findMany({
        where: { firmId: user.activeFirmId },
        select: { id: true, name: true, slug: true, active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    : [];

  const timeEntries = await prisma.timeEntry.findMany({
    where: { matterId },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { timekeeper: { select: { id: true, email: true, name: true } } },
  });

  const invoices = await prisma.invoice.findMany({
    where: { matterId: matterId },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: { id: true, invoiceNumber: true, status: true, subtotalCents: true, totalCents: true, createdAt: true },
  });

  const tasks = await prisma.task.findMany({
    where: { matterId },
    orderBy: [{ completionPercent: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    take: 20,
    include: { assigneeUser: { select: { name: true, email: true } } },
  });

  const timelineEvents = await prisma.matterTimelineEvent.findMany({
    where: { matterId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { actorUser: { select: { name: true, email: true } } },
  });

  const matterFieldDefinitions = user?.activeFirmId
    ? await prisma.matterFieldDefinition.findMany({
        where: { firmId: user.activeFirmId, active: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: { id: true, key: true, label: true, type: true, helpText: true, required: true, options: true, lookupTarget: true },
      })
    : [];
  const matterFieldValues = matterFieldDefinitions.length
    ? await prisma.matterFieldValue.findMany({ where: { matterId }, include: { fieldDefinition: { select: { key: true } } } })
    : [];
  const contacts = user?.activeFirmId
      ? await prisma.contact.findMany({
        where: { firmId: user.activeFirmId },
        orderBy: [{ displayName: "asc" }],
        take: 250,
        select: { id: true, displayName: true, email: true, organization: true },
      })
    : [];

  if (!matter) {
    return (
      <main style={{ padding: 24 }}>
        <p>Matter not found.</p>
        <Link href="/matters">Back</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 18px 64px" }}>
      <Link href="/matters" style={{ color: "var(--sw-muted)", textDecoration: "none" }}>
        ← Matters
      </Link>
      <h1 style={{ marginTop: 14, marginBottom: 6 }}>{matter.displayName}</h1>
      <div style={{ color: "var(--sw-muted)", fontSize: 13 }}>Status: {matter.status}</div>

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Pipeline card fields</div>
        <PipelineFieldsForm
          matterId={matter.id}
          primaryEmail={matter.primaryEmail}
          primaryPhone={matter.primaryPhone}
          estimatedValueCents={matter.estimatedValueCents}
          intakeSpecialistId={matter.intakeSpecialistId}
          leadAttorneyId={matter.leadAttorneyId}
          referralSourceContactId={matter.referralSourceContactId}
          users={users}
          contacts={contacts.map((c) => ({ id: c.id, displayName: c.displayName, organization: c.organization }))}
        />
      </section>

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Location</div>
        <MatterLocationForm matterId={matter.id} primaryLocationId={matter.primaryLocationId ?? null} locations={allFirmLocations} />
      </section>

      <MatterFieldsCard
        matterId={matter.id}
        fields={matterFieldDefinitions.map((f) => ({
          id: f.id,
          key: f.key,
          label: f.label,
          type: f.type,
          helpText: f.helpText,
          required: f.required,
          options: Array.isArray(f.options) ? f.options.map(String) : [],
          lookupTarget: f.lookupTarget,
        }))}
        values={Object.fromEntries(matterFieldValues.map((v) => [v.fieldDefinition.key, v.value]))}
        users={users}
        contacts={contacts.map((c) => ({ id: c.id, displayName: c.displayName, email: c.email }))}
      />

      <TimeEntriesCard
        matterId={matter.id}
        users={users}
        locations={locations}
        initialEntries={timeEntries.map((t) => ({
          id: t.id,
          workDate: t.workDate.toISOString(),
          narrative: t.narrative,
          pricingMode: t.pricingMode,
          durationMinutes: t.durationMinutes,
          hourlyRateCents: t.hourlyRateCents,
          flatAmountCents: t.flatAmountCents,
          billable: t.billable,
          status: t.status,
          timekeeper: t.timekeeper,
        }))}
      />

      <BillingCard
        matterId={matter.id}
        invoices={invoices.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          subtotalCents: i.subtotalCents,
          totalCents: i.totalCents,
          createdAt: i.createdAt.toISOString(),
        }))}
      />

      <TimelineCard
        matterId={matter.id}
        initialEvents={timelineEvents.map((ev) => ({
          id: ev.id,
          eventType: ev.eventType,
          title: ev.title,
          body: ev.body,
          occurredAt: ev.occurredAt.toISOString(),
          actorName: ev.actorUser?.name || ev.actorUser?.email || null,
        }))}
      />

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div style={{ fontWeight: 800 }}>Tasks</div>
          <Link href="/tasks" style={{ color: "var(--sw-muted)", textDecoration: "none", fontSize: 13 }}>
            Manage tasks →
          </Link>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {tasks.length ? (
            tasks.map((t) => (
              <div key={t.id} style={{ border: "1px solid var(--sw-border)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 900 }}>{t.title}</div>
                  <div style={{ color: "var(--sw-muted)", fontSize: 12 }}>{t.completionPercent}% • {t.billingStatus.replace("_", " ")}</div>
                </div>
                <div style={{ marginTop: 6, color: "var(--sw-muted)", fontSize: 12 }}>
                  Assigned to {t.assigneeUser.name || t.assigneeUser.email || "Unknown"}
                  {t.deadline ? ` • Due ${t.deadline.toISOString().slice(0, 10)}` : ""}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: "var(--sw-muted)" }}>No tasks linked to this matter yet.</div>
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Intake (raw JSON, v0)</div>
        <pre
          style={{
            margin: 0,
            padding: 14,
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid var(--sw-border)",
            background: "rgba(0,0,0,0.25)",
            overflowX: "auto",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {JSON.stringify(matter.intake?.data ?? null, null, 2)}
        </pre>
      </section>

      <section
        style={{
          marginTop: 14,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 800 }}>Forms</div>
        <Link
          href={`/matters/${matter.id}/epis`}
          style={{ color: "var(--sw-text)", textDecoration: "none", fontWeight: 800 }}
        >
          Open EPIS (staff) →
        </Link>
      </section>

      <section
        style={{
          marginTop: 14,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Generate</div>
        <GeneratePacketButton matterId={matter.id} />
        <p style={{ marginTop: 10, marginBottom: 0, color: "var(--sw-muted)" }}>
          Next: expand this into the full joint trust + pour-over wills/ancillaries packet.
        </p>
      </section>
    </main>
  );
}
