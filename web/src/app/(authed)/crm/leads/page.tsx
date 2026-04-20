import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConvertLeadButton } from "./ConvertLeadButton";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.crmLeadPipeline.findMany({
    orderBy: [{ dateAdded: "desc" }],
    take: 200,
    include: {
      contact: true,
      campaign: true,
      convertedMatter: { select: { id: true, displayName: true } },
    },
  });

  return (
    <div className="sw-page">
      <h1 className="sw-h1">Leads</h1>
      <p style={{ marginTop: 8 }} className="sw-muted">
        Summary view (MVP). We’ll match your Miro table columns next.
      </p>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table className="sw-table">
          <thead>
            <tr>
              <th className="sw-th">Name</th>
              <th className="sw-th">Campaign</th>
              <th className="sw-th">Date Added</th>
              <th className="sw-th">Notes</th>
              <th className="sw-th">Intake Attempted</th>
              <th className="sw-th">Appt 1</th>
              <th className="sw-th">Show</th>
              <th className="sw-th">Quality</th>
              <th className="sw-th">Appt 2</th>
              <th className="sw-th">Closed</th>
              <th className="sw-th">Convert</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="sw-tr">
                <td className="sw-td" style={{ fontWeight: 900 }}>
                  {l.contact.firstName} {l.contact.lastName}
                  <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>{l.contact.phoneE164}</div>
                </td>
                <td className="sw-td">{l.campaign.slug}</td>
                <td className="sw-td">{l.dateAdded.toISOString().slice(0, 10)}</td>
                <td className="sw-td">{l.additionalNotes || ""}</td>
                <td className="sw-td">{l.intakeCallAttempted ? "Y" : "N"}</td>
                <td className="sw-td">{l.appt1At ? l.appt1At.toISOString().slice(0, 10) : ""}</td>
                <td className="sw-td">{l.appt1Status || ""}</td>
                <td className="sw-td">{l.leadQualityScore ?? ""}</td>
                <td className="sw-td">{l.appt2At ? l.appt2At.toISOString().slice(0, 10) : ""}</td>
                <td className="sw-td">{l.closed ? "Y" : "N"}</td>
                <td className="sw-td">
                  {l.convertedMatterId ? (
                    <Link href={`/matters/${l.convertedMatterId}`} style={{ color: "inherit" }}>
                      Matter →
                    </Link>
                  ) : (
                    <ConvertLeadButton leadId={l.id} />
                  )}
                </td>
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
