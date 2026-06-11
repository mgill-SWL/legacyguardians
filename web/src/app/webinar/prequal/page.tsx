import { WebinarPrequalForm } from "./WebinarPrequalForm";

export const dynamic = "force-dynamic";

export default async function WebinarPrequalPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; token?: string }>;
}) {
  const params = await searchParams;

  return (
    <main
      style={{
        background: "#f5f7fb",
        color: "#172033",
        minHeight: "100vh",
        padding: "28px 16px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <header style={{ borderBottom: "1px solid rgba(23, 32, 51, 0.12)", paddingBottom: 18 }}>
          <div style={{ color: "#2E4A7F", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Speedwell Law
          </div>
          <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: "8px 0 0" }}>Estate planning webinar follow-up</h1>
          <p style={{ color: "rgba(23, 32, 51, 0.66)", fontSize: 16, lineHeight: 1.5, margin: "10px 0 0", maxWidth: 720 }}>
            Answer a few questions so our team can route you to the right next step. This is not the full estate planning intake.
          </p>
        </header>

        <WebinarPrequalForm campaignSlug={params.campaign || "webinar-prequal"} watchToken={params.token || ""} />
      </div>
    </main>
  );
}
