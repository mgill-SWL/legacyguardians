import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";

import { EpisEditorStaffFullClient } from "./EpisEditorStaffFullClient";

export const dynamic = "force-dynamic";

export default async function StaffEpisPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { matterId } = await params;

  return (
    <>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 18px 0" }}>
        <Link href={`/matters/${matterId}`} style={{ color: "var(--sw-muted)", textDecoration: "none" }}>
          ← Back to matter
        </Link>
      </div>
      <EpisEditorStaffFullClient matterId={matterId} />
    </>
  );
}
