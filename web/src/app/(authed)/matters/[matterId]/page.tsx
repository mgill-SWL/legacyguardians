import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { PipelineFieldsForm } from "./PipelineFieldsForm";
import { TimeEntriesCard } from "./TimeEntriesCard";
import { MatterLocationForm } from "./MatterLocationForm";
import { BillingCard } from "./BillingCard";

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
          users={users}
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
        <form action={`/api/matters/${matter.id}/generate`} method="post">
          <button
            type="submit"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid rgba(110,231,255,0.45)",
              background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
              fontWeight: 800,
              color: "var(--sw-text)",
              cursor: "pointer",
            }}
          >
            Generate packet (ZIP, v0)
          </button>
        </form>
        <p style={{ marginTop: 10, marginBottom: 0, color: "var(--sw-muted)" }}>
          Next: expand this into the full joint trust + pour-over wills/ancillaries packet.
        </p>
      </section>
    </main>
  );
}
