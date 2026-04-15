import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MattersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const matters = await prisma.matter.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      displayName: true,
      status: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Matters</h1>
        <Link
          href="/matters/new"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(110,231,255,0.45)",
            background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
            fontWeight: 900,
            textDecoration: "none",
            color: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          Create matter
        </Link>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--sw-border, rgba(255,255,255,0.12))" }}>
              <th style={{ padding: "10px 8px" }}>Name</th>
              <th style={{ padding: "10px 8px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {matters.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 900 }}>
                  <Link href={`/matters/${m.id}`} style={{ color: "inherit" }}>
                    {m.displayName}
                  </Link>
                </td>
                <td style={{ padding: "10px 8px" }}>{m.status}</td>
                <td style={{ padding: "10px 8px" }}>{m.updatedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {matters.length === 0 ? (
          <div style={{ marginTop: 12, color: "var(--sw-muted, #aab4d4)" }}>No matters yet.</div>
        ) : null}
      </div>
    </div>
  );
}
