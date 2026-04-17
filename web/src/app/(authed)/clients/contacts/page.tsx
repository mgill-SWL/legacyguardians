import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ContactsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const contacts = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Contacts</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted)" }}>
        One table, multi-category (Client / Vendor / Referrer). MVP.
      </p>

      <ContactsClient initialContacts={contacts} />
    </div>
  );
}
