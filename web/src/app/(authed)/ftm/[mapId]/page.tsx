import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FtmMapPage(props: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await props.params;

  const map = await prisma.ftmMap.findUnique({
    where: { id: mapId },
    include: {
      steps: {
        orderBy: { sortOrder: "asc" },
        include: {
          howOwnerUser: { select: { email: true, name: true } },
          ensureOwnerUser: { select: { email: true, name: true } },
          doerUser: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (!map) return <div style={{ padding: 24 }}>Task map not found</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{map.title}</h1>
          {map.description ? (
            <div style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>{map.description}</div>
          ) : null}
        </div>
        <Link href="/ftm" style={{ color: "inherit" }}>
          Back →
        </Link>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--sw-border, rgba(255,255,255,0.12))" }}>
              <th style={{ padding: "10px 8px" }}>Step</th>
              <th style={{ padding: "10px 8px" }}>How owner</th>
              <th style={{ padding: "10px 8px" }}>Ensure owner</th>
              <th style={{ padding: "10px 8px" }}>Doer</th>
            </tr>
          </thead>
          <tbody>
            {map.steps.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 900 }}>{s.name}</td>
                <td style={{ padding: "10px 8px" }}>{s.howOwnerUser?.email || ""}</td>
                <td style={{ padding: "10px 8px" }}>{s.ensureOwnerUser?.email || ""}</td>
                <td style={{ padding: "10px 8px" }}>{s.doerUser?.email || s.doerRole || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {map.steps.length === 0 ? (
          <div style={{ marginTop: 12, color: "var(--sw-muted, #aab4d4)" }}>No steps yet.</div>
        ) : null}
      </div>
    </div>
  );
}
