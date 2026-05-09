export const dynamic = "force-dynamic";

export default function TrustReconciliationPage() {
  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Three-way reconciliation</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Placeholder. This should store monthly reconciliation runs (bank vs books vs sum of client ledgers), with maker/checker approval
        and an immutable audit trail.
      </p>
    </div>
  );
}

