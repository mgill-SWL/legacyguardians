import path from "path";
import { readFile } from "fs/promises";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ManagementTextEditor } from "../ManagementTextEditor";

export const dynamic = "force-dynamic";

async function defaultContent() {
  const p = path.join(process.cwd(), "..", "spec", "management", "vivid-vision.txt");
  return readFile(p, "utf8");
}

export default async function CoreValuesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canEdit = user?.role === "ADMIN";

  const slug = "core-values";
  const title = "Core Values";

  const existing = await prisma.managementPage.findUnique({ where: { slug } });
  const page = existing
    ? existing
    : await prisma.managementPage.create({
        data: {
          slug,
          title,
          content: await defaultContent(),
        },
      });

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{page.title}</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted)" }}>Visible to everyone, editable by admins.</p>

      <ManagementTextEditor
        slug={slug}
        initialTitle={page.title}
        initialContent={page.content}
        canEdit={canEdit}
      />
    </div>
  );
}
