export const dynamic = "force-dynamic";

import { SupportChat } from "./ui";

export default function SupportPage() {
  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Support</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Ask questions about process, parking, pricing, and other firm ops. Answers are grounded in Help Topics + Pricing.
      </p>
      <SupportChat />
    </div>
  );
}
