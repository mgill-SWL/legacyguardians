import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.crmLeadPipeline.findMany({
    orderBy: [{ dateAdded: "desc" }],
    take: 200,
    include: {
      contact: true,
      campaign: true,
    },
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Leads</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Summary view (MVP). We’ll match your Miro table columns next.
      </p>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--sw-border, rgba(255,255,255,0.12))" }}>
              <th style={{ padding: "10px 8px" }}>Name</th>
              <th style={{ padding: "10px 8px" }}>Campaign</th>
              <th style={{ padding: "10px 8px" }}>Date Added</th>
              <th style={{ padding: "10px 8px" }}>Notes</th>
              <th style={{ padding: "10px 8px" }}>Intake Attempted</th>
              <th style={{ padding: "10px 8px" }}>Appt 1</th>
              <th style={{ padding: "10px 8px" }}>Show</th>
              <th style={{ padding: "10px 8px" }}>Quality</th>
              <th style={{ padding: "10px 8px" }}>Appt 2</th>
              <th style={{ padding: "10px 8px" }}>Closed</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 800 }}>
                  {l.contact.firstName} {l.contact.lastName}
                  <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>{l.contact.phoneE164}</div>
                </td>
                <td style={{ padding: "10px 8px" }}>{l.campaign.slug}</td>
                <td style={{ padding: "10px 8px" }}>{l.dateAdded.toISOString().slice(0, 10)}</td>
                <td style={{ padding: "10px 8px" }}>{l.additionalNotes || ""}</td>
                <td style={{ padding: "10px 8px" }}>{l.intakeCallAttempted ? "Y" : "N"}</td>
                <td style={{ padding: "10px 8px" }}>{l.appt1At ? l.appt1At.toISOString().slice(0, 10) : ""}</td>
                <td style={{ padding: "10px 8px" }}>{l.appt1Status || ""}</td>
                <td style={{ padding: "10px 8px" }}>{l.leadQualityScore ?? ""}</td>
                <td style={{ padding: "10px 8px" }}>{l.appt2At ? l.appt2At.toISOString().slice(0, 10) : ""}</td>
                <td style={{ padding: "10px 8px" }}>{l.closed ? "Y" : "N"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {leads.length === 0 ? (
          <div style={{ marginTop: 12, color: "var(--sw-muted, #aab4d4)" }}>No leads yet.</div>
        ) : null}
      </div>

      <div style={{ marginTop: 16, color: "var(--sw-muted, #aab4d4)" }}>
        <Link href="/crm/reports/weekly">Weekly report</Link>
      </div>
    </div>
  );
}
