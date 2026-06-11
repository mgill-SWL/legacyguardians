"use client";

import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";

import styles from "./TopRibbon.module.css";

type CreateType = "lead" | "contact" | "matter";

type SearchResult = {
  href: string;
  id: string;
  label: string;
  meta: string;
  type: "Lead" | "Contact" | "Matter";
};

const CREATE_OPTIONS: Array<{ type: CreateType; label: string; description: string; icon: string }> = [
  { type: "lead", label: "Lead", description: "Prospect record for intake and proposal work.", icon: "L" },
  { type: "contact", label: "Contact", description: "Client, referral source, advisor, or general contact.", icon: "C" },
  { type: "matter", label: "Matter", description: "Client work record after engagement or for internal setup.", icon: "M" },
];

function titleFromPath(pathname: string) {
  if (pathname.startsWith("/crm/leads")) return "Leads";
  if (pathname.startsWith("/crm/inbox")) return "Inbox";
  if (pathname.startsWith("/crm/queue")) return "Queue";
  if (pathname.startsWith("/crm")) return "CRM";
  if (pathname.startsWith("/clients/contacts")) return "Contacts";
  if (pathname.startsWith("/clients/billing")) return "Billing";
  if (pathname.startsWith("/matters")) return "Matters";
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/management")) return "Management";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

function splitName(input: string) {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) || "" };
}

function blankForm(type: CreateType): Record<string, string> {
  if (type === "lead") {
    return {
      name: "",
      email: "",
      phone: "",
      campaignName: "Manual lead",
      additionalNotes: "",
    };
  }
  if (type === "contact") {
    return {
      displayName: "",
      email: "",
      phone: "",
      organization: "",
      category: "CLIENT",
      notes: "",
    };
  }
  return {
    displayName: "",
  };
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

export function TopRibbon() {
  const router = useRouter();
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const createTitle = useMemo(() => {
    if (createType === "lead") return "Create lead";
    if (createType === "contact") return "Create contact";
    if (createType === "matter") return "Create matter";
    return "";
  }, [createType]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; results?: SearchResult[] };
        if (data.ok) setResults(data.results || []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (createRef.current && !createRef.current.contains(target)) setMenuOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (createType) closeDialog();
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (createType) window.setTimeout(() => firstFieldRef.current?.focus(), 0);
  }, [createType]);

  function openCreate(type: CreateType) {
    setForm(blankForm(type));
    setCreateType(type);
    setMenuOpen(false);
    setError(null);
    setMessage(null);
  }

  function closeDialog() {
    if (busy) return;
    setCreateType(null);
    setError(null);
    setMessage(null);
  }

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function goToResult(result: SearchResult) {
    setQuery("");
    setSearchOpen(false);
    router.push(result.href);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!createType) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (createType === "lead") {
        const { firstName, lastName } = splitName(form.name || "");
        const res = await fetch("/api/crm/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            email: form.email,
            phone: form.phone,
            campaignName: form.campaignName,
            additionalNotes: form.additionalNotes,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; leadId?: string; error?: string };
        if (!res.ok || data.ok === false || !data.leadId) throw new Error(data.error || `HTTP ${res.status}`);
        setMessage("Lead created.");
        router.push(`/crm/leads/${data.leadId}`);
      } else if (createType === "contact") {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: form.displayName,
            email: form.email,
            phone: form.phone,
            organization: form.organization,
            categories: [form.category || "CLIENT"],
            notes: form.notes,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !data.id) throw new Error(data.error || `HTTP ${res.status}`);
        setMessage("Contact created.");
        router.push(`/clients/contacts?selected=${data.id}`);
      } else {
        const res = await fetch("/api/matters", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ displayName: form.displayName }),
        });
        const data = (await res.json().catch(() => ({}))) as { matterId?: string; error?: string };
        if (!res.ok || !data.matterId) throw new Error(data.error || `HTTP ${res.status}`);
        setMessage("Matter created.");
        router.push(`/matters/${data.matterId}`);
      }
      setCreateType(null);
      router.refresh();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const createDialog = createType ? (
    <div className={styles.scrim} onMouseDown={(event) => event.currentTarget === event.target && closeDialog()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="create-dialog-title">
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle} id="create-dialog-title">
            {createTitle}
          </h2>
          <button aria-label="Close dialog" className={styles.closeButton} onClick={closeDialog} type="button">
            x
          </button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.form}>
            {error ? <div className={styles.error}>{error}</div> : null}
            {message ? <div className={styles.success}>{message}</div> : null}
            {createType === "lead" ? (
              <LeadFields form={form} firstFieldRef={firstFieldRef} updateField={updateField} />
            ) : createType === "contact" ? (
              <ContactFields form={form} firstFieldRef={firstFieldRef} updateField={updateField} />
            ) : (
              <MatterFields form={form} firstFieldRef={firstFieldRef} updateField={updateField} />
            )}
          </div>
          <div className={styles.dialogFooter}>
            <button className="sw-btn" disabled={busy} onClick={closeDialog} type="button">
              Cancel
            </button>
            <button className="sw-btn sw-btnPrimary" disabled={busy} type="submit">
              {busy ? "Creating..." : createTitle}
            </button>
          </div>
        </form>
      </section>
    </div>
  ) : null;

  return (
    <>
      <header className={styles.ribbon}>
      <div className={styles.leftCluster}>
        <button
          aria-label="Toggle navigation"
          className={styles.navToggle}
          onClick={() => window.dispatchEvent(new CustomEvent("lg:toggle-sidebar"))}
          title="Toggle navigation"
          type="button"
        >
          &lt;
        </button>
        <div className={styles.crumb} aria-label="Current section">
          <span>Home</span>
          <span>/</span>
          <strong>{title}</strong>
        </div>
      </div>

      <div className={styles.searchWrap} ref={searchRef}>
        <label className={styles.searchBox}>
          <span className={styles.searchIcon} aria-hidden>
            O
          </span>
          <input
            aria-label="Search Legacy Guardians"
            className={styles.searchInput}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search Legacy Guardians..."
            value={query}
          />
        </label>
        {searchOpen && query.trim().length >= 2 ? (
          <div className={styles.searchResults} role="listbox" aria-label="Search results">
            {searching ? <div className={styles.emptyState}>Searching...</div> : null}
            {!searching && results.length === 0 ? <div className={styles.emptyState}>No matching records.</div> : null}
            {results.map((result) => (
              <button className={styles.resultButton} key={`${result.type}-${result.id}`} onClick={() => goToResult(result)} type="button">
                <span className={styles.resultIcon}>{result.type.slice(0, 1)}</span>
                <span className={styles.resultText}>
                  <strong>{result.label}</strong>
                  <span>{result.meta}</span>
                </span>
                <span className={styles.resultType}>{result.type}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.rightCluster}>
        <div className={styles.createWrap} ref={createRef}>
          <button className={styles.createButton} onClick={() => setMenuOpen((open) => !open)} type="button">
            <span aria-hidden>+</span>
            Create New
          </button>
          {menuOpen ? (
            <div className={styles.createMenu} aria-label="Create new menu">
              {CREATE_OPTIONS.map((option) => (
                <button className={styles.menuButton} key={option.type} onClick={() => openCreate(option.type)} type="button">
                  <span className={styles.menuIcon}>{option.icon}</span>
                  <span className={styles.menuText}>
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </span>
                  <span className={styles.resultType}>New</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      </header>
      {mounted && createDialog ? createPortal(createDialog, document.body) : null}
    </>
  );
}

function LeadFields({
  form,
  firstFieldRef,
  updateField,
}: {
  form: Record<string, string>;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  updateField: (key: string, value: string) => void;
}) {
  return (
    <div className={styles.fieldGrid}>
      <label className={styles.field}>
        <span>Lead name</span>
        <input ref={firstFieldRef} className="sw-input" required value={form.name || ""} onChange={(e) => updateField("name", e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Phone</span>
        <input className="sw-input" required type="tel" value={form.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input className="sw-input" type="email" value={form.email || ""} onChange={(e) => updateField("email", e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Source / campaign</span>
        <input className="sw-input" value={form.campaignName || ""} onChange={(e) => updateField("campaignName", e.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.fullWidth}`}>
        <span>Notes</span>
        <textarea className="sw-input" rows={4} value={form.additionalNotes || ""} onChange={(e) => updateField("additionalNotes", e.target.value)} />
      </label>
    </div>
  );
}

function ContactFields({
  form,
  firstFieldRef,
  updateField,
}: {
  form: Record<string, string>;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  updateField: (key: string, value: string) => void;
}) {
  return (
    <div className={styles.fieldGrid}>
      <label className={styles.field}>
        <span>Display name</span>
        <input ref={firstFieldRef} className="sw-input" required value={form.displayName || ""} onChange={(e) => updateField("displayName", e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Category</span>
        <select className="sw-input" value={form.category || "CLIENT"} onChange={(e) => updateField("category", e.target.value)}>
          <option value="CLIENT">Client</option>
          <option value="REFERRER">Referrer</option>
          <option value="PROFESSIONAL_ADVISOR">Professional advisor</option>
          <option value="VENDOR">Vendor</option>
          <option value="GENERAL">General</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input className="sw-input" type="email" value={form.email || ""} onChange={(e) => updateField("email", e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Phone</span>
        <input className="sw-input" type="tel" value={form.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Organization</span>
        <input className="sw-input" value={form.organization || ""} onChange={(e) => updateField("organization", e.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.fullWidth}`}>
        <span>Notes</span>
        <textarea className="sw-input" rows={4} value={form.notes || ""} onChange={(e) => updateField("notes", e.target.value)} />
      </label>
    </div>
  );
}

function MatterFields({
  form,
  firstFieldRef,
  updateField,
}: {
  form: Record<string, string>;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  updateField: (key: string, value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>Matter name</span>
      <input ref={firstFieldRef} className="sw-input" required value={form.displayName || ""} onChange={(e) => updateField("displayName", e.target.value)} />
    </label>
  );
}
