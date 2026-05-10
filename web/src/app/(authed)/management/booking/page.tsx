import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { BookingAdminClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function BookingAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canEdit = user?.role === "ADMIN";

  const types = await prisma.appointmentType.findMany({
    include: { assignees: true },
    orderBy: { updatedAt: "desc" },
  });

  const connections = await prisma.googleConnection.findMany({
    orderBy: { updatedAt: "desc" },
    select: { googleEmail: true },
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Booking</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Configure appointment types (duration, buffers, notice, booking window) and assignees (Google calendars + working
        hours).
      </p>

      <BookingAdminClient
        initialTypes={types}
        googleEmails={connections.map((c) => c.googleEmail)}
        canEdit={!!canEdit}
      />
    </div>
  );
}

