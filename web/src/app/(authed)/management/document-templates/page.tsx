import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { getDocumensoConnectionStatus } from "@/lib/documenso/client";
import { prisma } from "@/lib/prisma";
import { DocumentTemplatesClient } from "./ui";

export const dynamic = "force-dynamic";

function canEditTemplates({ userRole, memberRole }: { userRole?: string | null; memberRole?: string | null }) {
  return userRole === "ADMIN" || memberRole === "ADMIN";
}

export default async function DocumentTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, activeFirmId: true, role: true },
  });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({
    where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } },
    select: { role: true },
  });

  const templates = await prisma.documentTemplate.findMany({
    where: { firmId: user.activeFirmId },
    orderBy: [{ active: "desc" }, { kind: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      kind: true,
      description: true,
      sourceFileName: true,
      mimeType: true,
      sizeBytes: true,
      active: true,
      updatedAt: true,
      createdByUser: { select: { name: true, email: true } },
    },
  });
  const documensoStatus = await getDocumensoConnectionStatus();

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Document templates</h1>
      </div>

      <p className="sw-muted" style={{ marginTop: 8, maxWidth: 900 }}>
        Upload firm document templates for e-sign eligible workflows. Representation agreements are the first supported target; testamentary
        execution documents stay outside this library.
      </p>

      <DocumentTemplatesClient
        initialTemplates={templates.map((template) => ({
          ...template,
          updatedAt: template.updatedAt.toISOString(),
          createdByLabel: template.createdByUser?.name || template.createdByUser?.email || null,
        }))}
        initialDocumensoStatus={documensoStatus}
        canEdit={canEditTemplates({ userRole: user.role, memberRole: member?.role })}
      />
    </div>
  );
}
