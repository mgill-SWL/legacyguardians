import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { HelpWidget } from "@/components/help/HelpWidget";
import { UnsavedChangesProvider } from "@/components/unsaved/UnsavedChangesProvider";

export const dynamic = "force-dynamic";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <UnsavedChangesProvider>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          background: "var(--sw-bg, #0b1020)",
          color: "var(--sw-text, #eef2ff)",
        }}
      >
        <SidebarNav email={session.user.email} />
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        <HelpWidget />
      </div>
    </UnsavedChangesProvider>
  );
}
