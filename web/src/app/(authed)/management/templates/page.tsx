import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { TemplatesClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canEdit = user?.role === "ADMIN";

  const templates = await prisma.messageTemplate.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Templates</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Central library for SMS + email templates used by automations.
      </p>

      <TemplatesClient initialTemplates={templates} canEdit={!!canEdit} />
    </div>
  );
}
