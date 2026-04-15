"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SignOutButton } from "@/components/SignOutButton";
import { useUnsavedChanges } from "@/components/unsaved/UnsavedChangesProvider";

type Item = { href: string; label: string; icon: string };

type Group = { label: string; items: Item[]; defaultOpen?: boolean };

const GROUPS: Group[] = [
  {
    label: "",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "D" }],
  },
  {
    label: "CRM",
    defaultOpen: true,
    items: [
      { href: "/crm/work", label: "Work", icon: "W" },
      { href: "/crm/leads", label: "Leads", icon: "L" },
    ],
  },
  {
    label: "Documents",
    items: [{ href: "/matters", label: "Matters", icon: "M" }],
  },
  {
    label: "KPIs",
    items: [
      { href: "/crm/spend", label: "Spend", icon: "$" },
      { href: "/crm/reports/weekly", label: "Weekly", icon: "R" },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/settings/ringcentral", label: "Integrations", icon: "I" }],
  },
];

function NavButton({
  href,
  label,
  icon,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: collapsed ? "10px 10px" : "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
        color: "inherit",
        fontWeight: 800,
        background: "rgba(255,255,255,0.03)",
        cursor: "pointer",
      }}
      aria-label={label}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(255,255,255,0.03)",
          fontWeight: 900,
        }}
      >
        {icon}
      </span>
      {collapsed ? null : <span>{label}</span>}
    </button>
  );
}

export function SidebarNav({ email }: { email: string | null | undefined }) {
  const router = useRouter();
  const { dirty, saveFn, setDirty, registerSaveFn } = useUnsavedChanges();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of GROUPS) {
      if (g.label) init[g.label] = !!g.defaultOpen;
    }
    return init;
  });

  useEffect(() => {
    const v = window.localStorage.getItem("lg.sidebar.collapsed");
    if (v === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("lg.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const flatItems = useMemo(() => GROUPS.flatMap((g) => g.items), []);

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
          width: collapsed ? 84 : 280,
          padding: 16,
          borderRight: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ padding: "6px 6px 2px", overflow: "hidden" }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.2, whiteSpace: "nowrap" }}>
              {collapsed ? "LG" : "Legacy Guardians"}
            </div>
            {collapsed ? null : (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>Staff console</div>
            )}
          </div>

          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.03)",
              color: "inherit",
              fontWeight: 900,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            {collapsed ? ">" : "<"}
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {(collapsed ? [{ label: "", items: flatItems }] : GROUPS).map((g, idx) => {
            const isOpen = g.label ? openGroups[g.label] : true;
            return (
              <div key={`${g.label}-${idx}`} style={{ display: "grid", gap: 8 }}>
                {g.label && !collapsed ? (
                  <button
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [g.label]: !prev[g.label] }))
                    }
                    style={{
                      textAlign: "left",
                      padding: "6px 6px",
                      background: "transparent",
                      border: "none",
                      color: "var(--sw-muted, #aab4d4)",
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{g.label}</span>
                    <span style={{ opacity: 0.8 }}>{isOpen ? "▾" : "▸"}</span>
                  </button>
                ) : null}

                {(!g.label || collapsed || isOpen) ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {g.items.map((n) => (
                      <NavButton
                        key={n.href}
                        href={n.href}
                        label={n.label}
                        icon={n.icon}
                        collapsed={collapsed}
                        onClick={() => requestNav(n.href)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
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
