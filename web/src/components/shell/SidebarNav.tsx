"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/SignOutButton";
import { useUnsavedChanges } from "@/components/unsaved/UnsavedChangesProvider";

type Item = { href: string; label: string };

const NAV: Item[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/crm/inbox", label: "Inbox" },
  { href: "/crm/queue", label: "Queue" },
  { href: "/crm/leads", label: "Leads" },
  { href: "/crm/spend", label: "Spend" },
  { href: "/crm/reports/weekly", label: "Weekly report" },
  { href: "/settings/ringcentral", label: "Integrations" },
  { href: "/matters", label: "Matters" },
];

function NavButton({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--sw-border, #ddd)",
        color: "inherit",
        fontWeight: 800,
        background: "rgba(255,255,255,0.03)",
        cursor: "pointer",
      }}
      aria-label={label}
    >
      {label}
    </button>
  );
}

export function SidebarNav({ email }: { email: string | null | undefined }) {
  const router = useRouter();
  const { dirty, saveFn, setDirty, registerSaveFn } = useUnsavedChanges();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  function requestNav(href: string) {
    if (!dirty) {
      router.push(href);
      return;
    }
    setPendingHref(href);
  }

  async function saveAndLeave() {
    const href = pendingHref;
    if (!href) return;

    try {
      if (saveFn) {
        await saveFn();
      }
      // If the page didn’t clear it, clear guard anyway.
      setDirty(false);
      registerSaveFn(null);
    } finally {
      setPendingHref(null);
      router.push(href);
    }
  }

  function leaveWithoutSaving() {
    const href = pendingHref;
    if (!href) return;
    setDirty(false);
    registerSaveFn(null);
    setPendingHref(null);
    router.push(href);
  }

  return (
    <>
      <aside
        style={{
          width: 280,
          padding: 16,
          borderRight: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ padding: "6px 6px 2px" }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.2 }}>
            Legacy Guardians
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
            Staff console
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {NAV.map((n) => (
            <NavButton key={n.href} href={n.href} label={n.label} onClick={() => requestNav(n.href)} />
          ))}
        </div>

        <div style={{ marginTop: "auto", padding: 6 }}>
          <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)", marginBottom: 8 }}>
            Signed in as
            <div style={{ color: "var(--sw-text, #eef2ff)", fontWeight: 800, wordBreak: "break-word" }}>
              {email}
            </div>
          </div>
          <SignOutButton />
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
            {dirty ? "Unsaved changes" : ""}
          </div>
        </div>
      </aside>

      {pendingHref ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0b1020",
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Save progress before leaving?</div>
            <div style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)", lineHeight: 1.35 }}>
              You have unsaved changes on this page.
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={saveAndLeave} style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(110,231,255,0.45)",
                background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
                fontWeight: 900,
                color: "inherit",
                cursor: "pointer",
              }}>
                Save and leave
              </button>
              <button onClick={leaveWithoutSaving} style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.04)",
                fontWeight: 800,
                color: "inherit",
                cursor: "pointer",
              }}>
                Leave without saving
              </button>
              <button onClick={() => setPendingHref(null)} style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                fontWeight: 800,
                color: "inherit",
                cursor: "pointer",
              }}>
                Cancel
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
              If you click “Save and leave”, we’ll save a draft and then navigate.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
