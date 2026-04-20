import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";

export const dynamic = "force-dynamic";

const SLUG = "intake-reporting";

const DEFAULT_COLUMNS: { key: string; label: string; type?: any }[] = [
  { key: "scheduled_intake", label: "Scheduled Intake", type: "NUMBER" },
  { key: "live_transfer", label: "Live Transfer (Lex)", type: "NUMBER" },
  { key: "ringcentral_calls", label: "RingCentral Incoming Calls", type: "NUMBER" },
  { key: "intake_no_shows", label: "Intake Call No Shows", type: "NUMBER" },
  { key: "total_intake_calls", label: "Total Intake Calls", type: "NUMBER" },
  { key: "qualified", label: "Qualified", type: "NUMBER" },
  { key: "strategy_meeting_500_booked", label: "$500 Strategy Meeting Booked", type: "NUMBER" },
  { key: "welcome_calls_booked", label: "Welcome Calls Booked", type: "NUMBER" },
  { key: "welcome_calls_held", label: "Welcome Calls Held", type: "NUMBER" },
  { key: "design_meetings_booked", label: "Design Meetings Booked", type: "NUMBER" },
  { key: "design_meetings_held", label: "Design Meetings Held", type: "NUMBER" },
  { key: "doc_tour_held", label: "Doc Tour Held", type: "NUMBER" },
  { key: "signing_held", label: "Signing Held", type: "NUMBER" },
  { key: "reviews_5_star", label: "5-star Reviews", type: "NUMBER" },
];

export default async function IntakeReportingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canAdmin = user?.role === "ADMIN";

  const table = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: {
      columns: { orderBy: { sortOrder: "asc" } },
      rows: { orderBy: { sortOrder: "asc" } },
    },
  });

  const ensured = table
    ? table
    : await prisma.reportTable.create({
        data: {
          slug: SLUG,
          name: "Intake Reporting",
          columns: {
            create: DEFAULT_COLUMNS.map((c, idx) => ({
              key: c.key,
              label: c.label,
              type: c.type || "TEXT",
              sortOrder: idx,
            })),
          },
          rows: {
            create: [],
          },
        },
        include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
      });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Intake Reporting</h1>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Manual entry
        </div>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        This replaces the Google Sheet. Admins can add columns; column delete is super-admin only.
      </p>

      <ReportGrid table={ensured as any} canAdmin={!!canAdmin} />
    </div>
  );
}
