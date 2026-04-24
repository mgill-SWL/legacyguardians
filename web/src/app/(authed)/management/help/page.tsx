import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { HelpTopicsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function HelpTopicsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canEdit = user?.role === "ADMIN";

  const firmId = user?.activeFirmId || undefined;

  const articles = await prisma.helpArticle.findMany({
    where: firmId ? { firmId } : undefined,
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Help Topics</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Internal knowledge base used by the chatbot and as a reference library.
      </p>
      <HelpTopicsClient initialArticles={articles} canEdit={!!canEdit} />
    </div>
  );
}
