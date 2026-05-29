import { prisma } from "@/lib/prisma";
import { sendAutomationSms } from "@/lib/ringcentralAutomation";
import { renderTemplate } from "@/lib/automation/templateRender";
import { sendAutomationEmail } from "@/lib/automation/sendAutomationEmail";

type NotificationChannel = "SMS" | "EMAIL";

const DEFAULT_APPOINTMENT_TIME_ZONE = "America/New_York";

function templateKeyFor(kind: string, channel: NotificationChannel) {
  const k = String(kind || "").toLowerCase();
  if (channel === "SMS") return `discovery_${k}_sms`;
  return `discovery_${k}_email`;
}

export function formatAppointmentStartTime(date: Date, timeZone = DEFAULT_APPOINTMENT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export async function sendDiscoveryAppointmentNotification({
  firmId,
  appointmentId,
  kind,
  channel,
}: {
  firmId: string;
  appointmentId: string;
  kind: string;
  channel: NotificationChannel;
}) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw new Error("Appointment not found");

  const assignee = await prisma.appointmentAssignee.findUnique({
    where: { typeId_googleEmail: { typeId: appt.typeId, googleEmail: appt.assignedGoogleEmail } },
    select: { timeZone: true },
  });

  const vars = {
    client_name: appt.clientName || "",
    start_time: formatAppointmentStartTime(appt.startsAt, assignee?.timeZone || DEFAULT_APPOINTMENT_TIME_ZONE),
    phone: appt.clientPhone || "",
    email: appt.clientEmail || "",
  };

  const tplKey = templateKeyFor(kind, channel);
  const tpl = await prisma.messageTemplate.findUnique({
    where: { firmId_key: { firmId, key: tplKey } },
  });
  if (!tpl) throw new Error(`Missing ${channel.toLowerCase()} template: ${tplKey}`);

  const text = renderTemplate(tpl.body, vars);
  if (channel === "SMS") {
    if (!appt.clientPhone) throw new Error("Missing client phone");
    await sendAutomationSms(appt.clientPhone, text);
    return;
  }

  if (!appt.clientEmail) throw new Error("Missing client email");
  const subject = renderTemplate(tpl.subject || tpl.name || "(no subject)", vars);
  await sendAutomationEmail({ to: appt.clientEmail, subject, text, html: tpl.isHtml ? text : null });
}
