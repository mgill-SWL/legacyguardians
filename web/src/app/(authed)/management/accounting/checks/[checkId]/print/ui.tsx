"use client";

import { useEffect, useMemo, useState } from "react";

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function amountWords(cents: number) {
  const dollars = Math.floor((cents || 0) / 100);
  const rem = Math.abs((cents || 0) % 100);
  const words = (n: number): string => {
    const ones = [
      "Zero",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    if (n < 20) return ones[n] || "";
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? `-${ones[n % 10]}` : ""}`;
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${words(n % 100)}` : ""}`;
    if (n < 1_000_000) {
      const th = Math.floor(n / 1000);
      const rest = n % 1000;
      return `${words(th)} Thousand${rest ? ` ${words(rest)}` : ""}`;
    }
    // Plenty for our current use.
    const mm = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    return `${words(mm)} Million${rest ? ` ${words(rest)}` : ""}`;
  };

  const rem2 = String(rem).padStart(2, "0");
  return `${words(dollars)} and ${rem2}/100`;
}

export function PrintCheckClient({
  checkId,
  payload,
}: {
  checkId: string;
  payload: { checkNumber: string | null; issueDate: string; payeeName: string; amountCents: number; memo: string; accountName: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkNumber, setCheckNumber] = useState<string | null>(payload.checkNumber);
  const amount = useMemo(() => usd(payload.amountCents), [payload.amountCents]);
  const amtWords = useMemo(() => amountWords(payload.amountCents), [payload.amountCents]);

  useEffect(() => {
    // noop: leave printing to the user (button click), since some browsers block auto-print.
  }, []);

  async function onPrint() {
    setBusy(true);
    setError(null);
    try {
      // Assign check number at print time (CosmoLex-style) if needed.
      let cn = checkNumber;
      if (!cn) {
        const resAssign = await fetch(`/api/accounting/checks/${checkId}/assign-number`, { method: "PATCH" });
        const jsonAssign = (await resAssign.json().catch(() => ({}))) as any;
        if (!resAssign.ok || jsonAssign.ok === false) throw new Error(jsonAssign.error || `HTTP ${resAssign.status}`);
        cn = String(jsonAssign.checkNumber || "");
        if (!cn) throw new Error("No check number returned");
        setCheckNumber(cn);
      }

      // Stamp printed.
      const res = await fetch(`/api/accounting/checks/${checkId}/printed`, { method: "PATCH" });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);

      // Give React a tick to render the assigned number before printing.
      await new Promise((r) => setTimeout(r, 50));
      window.print();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Print failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      <div className="sw-card sw-card-pad" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="sw-btn sw-btnPrimary" type="button" disabled={busy} onClick={onPrint}>
          {busy ? "Preparing…" : "Print"}
        </button>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Voucher check layout (CosmoLex-style). Printing is fussy; next step is per-printer/account alignment calibration.
        </div>
        {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}
      </div>

      {/* Print surface */}
      <div
        className="sw-card"
        style={{
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          id="lg-check-print"
          style={{
            width: "8.5in",
            height: "11in",
            margin: "0 auto",
            background: "white",
            color: "black",
            position: "relative",
          }}
        >
          {/* Voucher check layout (approx. based on the CosmoLex PDF). */}
          <div style={{ position: "absolute", top: "1.55in", left: "0.6in", right: "0.6in" }}>
            {/* Check face */}
            <div style={{ height: "3.1in", position: "relative" }}>
              {/* Top-right date + amount */}
              <div style={{ position: "absolute", top: 0, right: 0, textAlign: "right" }}>
                <div style={{ fontSize: 13 }}>{payload.issueDate}</div>
                <div style={{ marginTop: 10, fontSize: 14, fontFamily: "var(--sw-mono)", fontWeight: 700 }}>{amount.replace("$", "")}</div>
              </div>

              {/* Payee + amount words */}
              <div style={{ position: "absolute", top: 10, left: 0, right: "2.1in" }}>
                <div style={{ fontSize: 14 }}>{payload.payeeName}</div>
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  {amtWords}
                  {" "}
                  {"*".repeat(60)}
                </div>
              </div>

              {/* Check number shown near the detail grid */}
              <div style={{ position: "absolute", top: "0.05in", right: "2.3in", fontFamily: "var(--sw-mono)", fontSize: 12, fontWeight: 700 }}>
                #{checkNumber || "To print"}
              </div>

              {/* Detail grid */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, border: "1px solid #111" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                  {[
                    { l1: "Check #", v1: checkNumber || "To print", l2: "Check Date", v2: payload.issueDate, l3: "Check Amount", v3: amount },
                    { l1: "Client ID", v1: "", l2: "Matter File #", v2: "", l3: "Sub Acct #", v3: "" },
                    { l1: "Client Name", v1: "", l2: "Matter", v2: "", l3: "Payee", v3: payload.payeeName },
                  ].map((col, idx) => (
                    <div key={idx} style={{ borderLeft: idx === 0 ? "none" : "1px solid #111" }}>
                      <Field label={col.l1} value={col.v1} />
                      <Divider />
                      <Field label={col.l2} value={col.v2} />
                      <Divider />
                      <Field label={col.l3} value={col.v3} />
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid #111" }}>
                  <Field label="Memo1" value={payload.memo || ""} fullWidth />
                </div>
              </div>
            </div>

            {/* Stub 1 */}
            <Stub
              title={payload.accountName || "Voucher"}
              checkNumber={checkNumber || "To print"}
              checkDate={payload.issueDate}
              checkAmount={amount}
              payee={payload.payeeName}
              memo1={payload.memo || ""}
              memo2={null}
            />

            {/* Stub 2 */}
            <div style={{ marginTop: 10 }}>
              <Stub
                title={payload.accountName || "Voucher"}
                checkNumber={checkNumber || "To print"}
                checkDate={payload.issueDate}
                checkAmount={amount}
                payee={payload.payeeName}
                memo1={payload.memo || ""}
                memo2=""
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @page {
          size: letter portrait;
          margin: 0;
        }
        @media print {
          body {
            background: white !important;
          }
          .sw-pageHeader,
          .sw-card.sw-card-pad {
            display: none !important;
          }
          #lg-check-print {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #111" }} />;
}

function Field({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: fullWidth ? "140px 1fr" : "110px 1fr", gap: 8, padding: "6px 8px" }}>
      <div style={{ fontSize: 10, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, fontFamily: "var(--sw-mono)" }}>{value || ""}</div>
    </div>
  );
}

function Stub({
  title,
  checkNumber,
  checkDate,
  checkAmount,
  payee,
  memo1,
  memo2,
}: {
  title: string;
  checkNumber: string;
  checkDate: string;
  checkAmount: string;
  payee: string;
  memo1: string;
  memo2: string | null;
}) {
  return (
    <div style={{ border: "1px solid #111" }}>
      <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700 }}>{title}</div>
      <div style={{ borderTop: "1px solid #111" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div>
            <Field label="Check #" value={checkNumber} />
            <Divider />
            <Field label="Check Date" value={checkDate} />
            <Divider />
            <Field label="Check Amount" value={checkAmount} />
          </div>
          <div style={{ borderLeft: "1px solid #111" }}>
            <Field label="Client ID" value="" />
            <Divider />
            <Field label="Matter File #" value="" />
            <Divider />
            <Field label="Sub Acct #" value="" />
          </div>
          <div style={{ borderLeft: "1px solid #111" }}>
            <Field label="Client Name" value="" />
            <Divider />
            <Field label="Matter" value="" />
            <Divider />
            <Field label="Payee" value={payee} />
          </div>
        </div>
        <div style={{ borderTop: "1px solid #111" }}>
          <Field label="Memo1" value={memo1} fullWidth />
        </div>
        {memo2 !== null ? (
          <div style={{ borderTop: "1px solid #111" }}>
            <Field label="Memo2" value={memo2} fullWidth />
          </div>
        ) : null}
      </div>
    </div>
  );
}
