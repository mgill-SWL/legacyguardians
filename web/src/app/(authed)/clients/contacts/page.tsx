import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ContactsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { activeFirmId: true } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const [contacts, users] = await Promise.all([
    prisma.contact.findMany({
      where: { firmId: user.activeFirmId },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { relationshipOwner: { select: { id: true, name: true, email: true } } },
    }),
    prisma.firmMember.findMany({
      where: { firmId: user.activeFirmId },
      orderBy: { user: { email: "asc" } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Contacts</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted)" }}>
        One directory, multi-category: clients, vendors, referrers, professional advisors, and general contacts.
      </p>

      <ContactsClient initialContacts={contacts} users={users.map((u) => u.user).filter(Boolean)} />
    </div>
  );
}
