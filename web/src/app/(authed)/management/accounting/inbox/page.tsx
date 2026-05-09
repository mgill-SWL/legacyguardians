export const dynamic = "force-dynamic";

export default function AccountingInboxPage() {
  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Bookkeeping inbox</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Placeholder. Intended purpose: ingest raw bank/card transactions (CSV or direct feed), queue them for review, and normalize them
        into auditable bookkeeping/KPI events with matter/client/invoice linkage.
      </p>
    </div>
  );
}

