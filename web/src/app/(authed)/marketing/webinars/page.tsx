import { prisma } from "@/lib/prisma";

import styles from "../page.module.css";
import { CopyableSnippet } from "./CopyableSnippet";
import { DeleteWebinarButton } from "./DeleteWebinarButton";
import { NewWebinarForm } from "./NewWebinarForm";

export const dynamic = "force-dynamic";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN || "https://app.legacyguardians.ai";
const EVERGREEN_ISO = "2030-01-01T00:00:00.000Z";

function embedSnippet(slug: string, startsAtIso: string | null) {
  const params = new URLSearchParams({ campaign: slug });
  if (startsAtIso && startsAtIso !== EVERGREEN_ISO) params.set("starts", startsAtIso);
  const src = `${APP_ORIGIN}/embed/webinar-registration?${params.toString()}`;
  return [
    "<iframe",
    `  src="${src}"`,
    '  style="width:100%;max-width:480px;height:560px;border:0;"',
    '  title="Webinar Registration"></iframe>',
  ].join("\n");
}

function showingLabel(startsAt: Date) {
  if (startsAt.toISOString() === EVERGREEN_ISO) return "Evergreen (always-on)";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(startsAt);
}

export default async function WebinarsPage() {
  const webinars = await prisma.crmCampaign.findMany({
    where: { showings: { some: {} } },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { registrations: true } },
      showings: { select: { id: true, startsAt: true }, orderBy: { startsAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <div className={styles.eyebrow}>Marketing</div>
          <h1 className={styles.title}>Webinars</h1>
          <p className={styles.subcopy}>
            Each webinar is a campaign with one or more sessions. Create a webinar here, then embed its
            registration form on a landing page using the generated code. Registrations are grouped by the
            webinar&apos;s slug for reporting.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(280px, 360px) 1fr",
          alignItems: "start",
        }}
      >
        <section className="sw-card sw-card-pad">
          <h2 className={styles.sectionTitle}>New webinar</h2>
          <NewWebinarForm />
        </section>

        <section className="sw-card sw-card-pad">
          <h2 className={styles.sectionTitle}>Your webinars</h2>
          {webinars.length === 0 ? (
            <div className={styles.empty}>No webinars yet. Create one to get its embed code.</div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {webinars.map((w) => (
                <div key={w.id} style={{ borderTop: "1px solid var(--sw-border)", paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{w.name || w.slug}</div>
                      <div className={styles.metricNote}>
                        slug: <code>{w.slug}</code> · {w._count.registrations} registration
                        {w._count.registrations === 1 ? "" : "s"}
                      </div>
                    </div>
                    <DeleteWebinarButton id={w.id} name={w.name || w.slug} registrations={w._count.registrations} />
                  </div>

                  <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
                    {w.showings.map((s) => (
                      <div key={s.id} style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{showingLabel(s.startsAt)}</div>
                        <CopyableSnippet snippet={embedSnippet(w.slug, s.startsAt.toISOString())} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
