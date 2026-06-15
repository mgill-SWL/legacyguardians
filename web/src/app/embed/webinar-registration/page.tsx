import { WebinarRegistrationForm } from "./WebinarRegistrationForm";

export const dynamic = "force-dynamic";

const DEFAULT_EVERGREEN_SHOWING = "2030-01-01T00:00:00.000Z";

type SearchParams = {
  campaign?: string;
  showingId?: string;
  showingStartsAt?: string;
  starts?: string;
};

export default async function WebinarRegistrationEmbedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const showingStartsAt = params.showingStartsAt || params.starts || DEFAULT_EVERGREEN_SHOWING;

  return (
    <main
      data-transparent-embed
      style={{
        background: "transparent",
        boxSizing: "border-box",
        margin: 0,
        minHeight: "100vh",
        padding: 0,
      }}
    >
      <WebinarRegistrationForm
        campaignSlug={params.campaign || "estate-planning-webinar"}
        showingId={params.showingId}
        showingStartsAt={showingStartsAt}
      />
    </main>
  );
}
