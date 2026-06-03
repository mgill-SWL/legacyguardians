import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { TemplatesClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { activeFirmId: true, role: true } });
  const canEdit = !!user?.activeFirmId;
  const canDelete = !!user?.activeFirmId && user.role === "ADMIN";

  const firmId = user?.activeFirmId || undefined;

  const templates = await prisma.messageTemplate.findMany({
    where: firmId ? { firmId } : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      key: true,
      channel: true,
      name: true,
      subject: true,
      body: true,
      isHtml: true,
      attachmentUrl: true,
      updatedAt: true,
    },
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Templates</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Central library for SMS + email templates used by automations.
      </p>

      <TemplatesClient initialTemplates={templates} canEdit={!!canEdit} canDelete={canDelete} />
    </div>
  );
}
