"use client";

import { useState } from "react";

export function CopyableSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <textarea
        className="sw-input"
        readOnly
        rows={4}
        value={snippet}
        onFocus={(e) => e.currentTarget.select()}
        style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}
      />
      <div>
        <button type="button" className="sw-btn sw-btnSm" onClick={copy}>
          {copied ? "Copied" : "Copy embed code"}
        </button>
      </div>
    </div>
  );
}
