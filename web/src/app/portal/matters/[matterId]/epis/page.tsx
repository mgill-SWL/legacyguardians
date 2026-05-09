import Link from "next/link";
import { redirect } from "next/navigation";

import { requirePortalSession, portalCanAccessMatter } from "@/lib/portalAccess";

import { EpisEditorClient } from "./EpisEditorClient";

export const dynamic = "force-dynamic";

export default async function PortalEpisPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const session = await requirePortalSession();
  if (!session) redirect("/portal");

  const { matterId } = await params;
  const access = await portalCanAccessMatter({ matterId, email: session.email });
  if (!access.ok) {
    return (
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "44px 18px 64px" }}>
        <Link href="/portal" style={{ color: "var(--sw-muted)", textDecoration: "none" }}>
          ← Portal home
        </Link>
        <h1 style={{ marginTop: 14 }}>Access denied</h1>
      </main>
    );
  }

  return (
    <>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "18px 18px 0" }}>
        <Link href={`/portal/matters/${matterId}`} style={{ color: "var(--sw-muted)", textDecoration: "none" }}>
          ← Back
        </Link>
      </div>
      <EpisEditorClient matterId={matterId} />
    </>
  );
}

