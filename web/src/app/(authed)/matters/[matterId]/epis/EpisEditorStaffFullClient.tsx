"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { burialWishesPresets, distributionWishesPresets, healthcareWishesPresets, type Preset } from "@/lib/episPresets";

type Intake = any;

function newPersonId() {
  return `p_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

type ActingMode = "EITHER" | "JOINT";
type RankGroup = { actingMode: ActingMode; personIds: string[] };
type RankedRoles = {
  trustees: RankGroup[];
  executors: RankGroup[];
  financialAgents: RankGroup[];
  healthAgents: RankGroup[];
  guardians: RankGroup[];
};

type Wish = { presetKey?: string; text?: string };
type Wishes = {
  healthcare: { spouse1: Wish; spouse2: Wish };
  burial: { spouse1: Wish; spouse2: Wish };
  distribution: { spouse1: Wish; spouse2: Wish };
};

type Pets = {
  hasPets: boolean;
  count: number;
  perPetAmountCents: number;
  caregiverPersonId?: string;
  alternateCaregiverPersonId?: string;
  usePetTrust: boolean;
  petTrustEndowmentCents?: number;
  notes?: string;
};

type Advisors = {
  financialAdvisor?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    okToDiscuss?: boolean;
  };
  cpa?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    okToDiscuss?: boolean;
  };
  other: Array<{
    kind?: string;
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    okToDiscuss?: boolean;
  }>;
};

type FinancialAccountItem = {
  institution?: string;
  accountType?: string;
  last4?: string;
  notes?: string;
  approxValueCents?: number;
};

type RealEstateItem = {
  address?: string;
  notes?: string;
  approxValueCents?: number;
};

type AssetBuckets = {
  retirement: { approxTotalCents?: number; accounts: FinancialAccountItem[]; notes?: string };
  bank: { approxTotalCents?: number; accounts: FinancialAccountItem[]; notes?: string };
  brokerage: { approxTotalCents?: number; accounts: FinancialAccountItem[]; notes?: string };
  lifeInsurance: { approxTotalCents?: number; policies: Array<{ carrier?: string; last4?: string; notes?: string; benefitCents?: number }> ; notes?: string };
  businessInterests: { approxTotalCents?: number; items: Array<{ name?: string; notes?: string; approxValueCents?: number }>; notes?: string };
  vehicles: { approxTotalCents?: number; items: Array<{ description?: string; notes?: string; approxValueCents?: number }>; notes?: string };
  personalProperty: { approxTotalCents?: number; notes?: string };
  realEstate: { approxTotalCents?: number; properties: RealEstateItem[]; notes?: string; transactionsNext24Months?: boolean };
  alternativeAssets: { approxTotalCents?: number; items: Array<{ description?: string; notes?: string; approxValueCents?: number }>; notes?: string };
};

const SECTIONS: Array<{ key: string; label: string }> = [
  { key: "client_info", label: "Client information" },
  { key: "children", label: "Children" },
  { key: "fiduciaries", label: "Potential fiduciaries" },
  { key: "estate_value", label: "Value of estate" },
  { key: "distribution", label: "Distribution wishes" },
  { key: "pets", label: "Pets" },
  { key: "burial", label: "Burial wishes" },
  { key: "advisors", label: "Professional advisors" },
  { key: "conflicts", label: "Conflict waiver" },
];

function ensureNotes(intake: Intake) {
  const n = (intake?.__staffNotes ?? {}) as any;
  if (!n || typeof n !== "object") return { sections: {} as Record<string, string> };
  n.sections = n.sections && typeof n.sections === "object" ? n.sections : {};
  return n;
}

function ensureRankedRoles(intake: Intake): RankedRoles {
  const base: RankedRoles = {
    trustees: [],
    executors: [],
    financialAgents: [],
    healthAgents: [],
    guardians: [],
  };
  const existing = intake?.rankedRoles;
  if (!existing || typeof existing !== "object") return base;
  return {
    trustees: Array.isArray(existing.trustees) ? existing.trustees : [],
    executors: Array.isArray(existing.executors) ? existing.executors : [],
    financialAgents: Array.isArray(existing.financialAgents) ? existing.financialAgents : [],
    healthAgents: Array.isArray(existing.healthAgents) ? existing.healthAgents : [],
    guardians: Array.isArray(existing.guardians) ? existing.guardians : [],
  };
}

function ensureWishes(intake: Intake): Wishes {
  const empty: Wishes = {
    healthcare: { spouse1: {}, spouse2: {} },
    burial: { spouse1: {}, spouse2: {} },
    distribution: { spouse1: {}, spouse2: {} },
  };
  const w = intake?.wishes;
  if (!w || typeof w !== "object") return empty;
  const pick = (x: any) => ({ presetKey: x?.presetKey, text: x?.text });
  return {
    healthcare: {
      spouse1: pick((w as any)?.healthcare?.spouse1),
      spouse2: pick((w as any)?.healthcare?.spouse2),
    },
    burial: {
      spouse1: pick((w as any)?.burial?.spouse1),
      spouse2: pick((w as any)?.burial?.spouse2),
    },
    distribution: {
      spouse1: pick((w as any)?.distribution?.spouse1),
      spouse2: pick((w as any)?.distribution?.spouse2),
    },
  };
}

function ensurePets(intake: Intake): Pets {
  const p = (intake?.pets ?? {}) as any;
  return {
    hasPets: Boolean(p?.hasPets),
    count: Number.isFinite(p?.count) ? Number(p.count) : 0,
    perPetAmountCents: Number.isFinite(p?.perPetAmountCents) ? Number(p.perPetAmountCents) : 5000 * 100,
    caregiverPersonId: p?.caregiverPersonId || undefined,
    alternateCaregiverPersonId: p?.alternateCaregiverPersonId || undefined,
    usePetTrust: Boolean(p?.usePetTrust),
    petTrustEndowmentCents: Number.isFinite(p?.petTrustEndowmentCents) ? Number(p.petTrustEndowmentCents) : undefined,
    notes: typeof p?.notes === "string" ? p.notes : "",
  };
}

function ensureAdvisors(intake: Intake): Advisors {
  const a = (intake?.advisors ?? {}) as any;
  const pick = (x: any) =>
    x && typeof x === "object"
      ? {
          name: x.name || "",
          company: x.company || "",
          email: x.email || "",
          phone: x.phone || "",
          okToDiscuss: Boolean(x.okToDiscuss),
        }
      : { name: "", company: "", email: "", phone: "", okToDiscuss: false };
  return {
    financialAdvisor: pick(a.financialAdvisor),
    cpa: pick(a.cpa),
    other: Array.isArray(a.other)
      ? a.other.map((x: any) => ({
          kind: x?.kind || "",
          name: x?.name || "",
          company: x?.company || "",
          email: x?.email || "",
          phone: x?.phone || "",
          okToDiscuss: Boolean(x?.okToDiscuss),
        }))
      : [],
  };
}

function ensureAssets(intake: Intake): AssetBuckets {
  const a = (intake?.assets ?? {}) as any;
  const fa = (x: any): FinancialAccountItem => ({
    institution: x?.institution || "",
    accountType: x?.accountType || "",
    last4: x?.last4 || "",
    notes: x?.notes || "",
    approxValueCents: Number.isFinite(x?.approxValueCents) ? Number(x.approxValueCents) : undefined,
  });
  const re = (x: any): RealEstateItem => ({
    address: x?.address || "",
    notes: x?.notes || "",
    approxValueCents: Number.isFinite(x?.approxValueCents) ? Number(x.approxValueCents) : undefined,
  });
  const policy = (x: any) => ({
    carrier: x?.carrier || "",
    last4: x?.last4 || "",
    notes: x?.notes || "",
    benefitCents: Number.isFinite(x?.benefitCents) ? Number(x.benefitCents) : undefined,
  });
  const withAccounts = (node: any) => ({
    approxTotalCents: Number.isFinite(node?.approxTotalCents) ? Number(node.approxTotalCents) : undefined,
    accounts: Array.isArray(node?.accounts) ? node.accounts.map(fa) : [],
    notes: typeof node?.notes === "string" ? node.notes : "",
  });
  return {
    retirement: withAccounts(a.retirement),
    bank: withAccounts(a.bank),
    brokerage: withAccounts(a.brokerage),
    lifeInsurance: {
      approxTotalCents: Number.isFinite(a?.lifeInsurance?.approxTotalCents) ? Number(a.lifeInsurance.approxTotalCents) : undefined,
      policies: Array.isArray(a?.lifeInsurance?.policies) ? a.lifeInsurance.policies.map(policy) : [],
      notes: typeof a?.lifeInsurance?.notes === "string" ? a.lifeInsurance.notes : "",
    },
    businessInterests: {
      approxTotalCents: Number.isFinite(a?.businessInterests?.approxTotalCents) ? Number(a.businessInterests.approxTotalCents) : undefined,
      items: Array.isArray(a?.businessInterests?.items)
        ? a.businessInterests.items.map((x: any) => ({
            name: x?.name || "",
            notes: x?.notes || "",
            approxValueCents: Number.isFinite(x?.approxValueCents) ? Number(x.approxValueCents) : undefined,
          }))
        : [],
      notes: typeof a?.businessInterests?.notes === "string" ? a.businessInterests.notes : "",
    },
    vehicles: {
      approxTotalCents: Number.isFinite(a?.vehicles?.approxTotalCents) ? Number(a.vehicles.approxTotalCents) : undefined,
      items: Array.isArray(a?.vehicles?.items)
        ? a.vehicles.items.map((x: any) => ({
            description: x?.description || "",
            notes: x?.notes || "",
            approxValueCents: Number.isFinite(x?.approxValueCents) ? Number(x.approxValueCents) : undefined,
          }))
        : [],
      notes: typeof a?.vehicles?.notes === "string" ? a.vehicles.notes : "",
    },
    personalProperty: {
      approxTotalCents: Number.isFinite(a?.personalProperty?.approxTotalCents) ? Number(a.personalProperty.approxTotalCents) : undefined,
      notes: typeof a?.personalProperty?.notes === "string" ? a.personalProperty.notes : "",
    },
    realEstate: {
      approxTotalCents: Number.isFinite(a?.realEstate?.approxTotalCents) ? Number(a.realEstate.approxTotalCents) : undefined,
      properties: Array.isArray(a?.realEstate?.properties) ? a.realEstate.properties.map(re) : [],
      notes: typeof a?.realEstate?.notes === "string" ? a.realEstate.notes : "",
      transactionsNext24Months: Boolean(a?.realEstate?.transactionsNext24Months),
    },
    alternativeAssets: {
      approxTotalCents: Number.isFinite(a?.alternativeAssets?.approxTotalCents) ? Number(a.alternativeAssets.approxTotalCents) : undefined,
      items: Array.isArray(a?.alternativeAssets?.items)
        ? a.alternativeAssets.items.map((x: any) => ({
            description: x?.description || "",
            notes: x?.notes || "",
            approxValueCents: Number.isFinite(x?.approxValueCents) ? Number(x.approxValueCents) : undefined,
          }))
        : [],
      notes: typeof a?.alternativeAssets?.notes === "string" ? a.alternativeAssets.notes : "",
    },
  };
}

function sanitizeLast4(s: string) {
  const digits = String(s || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-4);
}

function moneyDollarsToCents(s: string) {
  const cleaned = String(s || "").replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function moneyCentsToDollars(cents: number) {
  const n = Number.isFinite(cents) ? cents : 0;
  return (n / 100).toFixed(2);
}

function PresetBlock({
  title,
  presets,
  value,
  onChange,
}: {
  title: string;
  presets: Preset[];
  value: Wish;
  onChange: (next: Wish) => void;
}) {
  const selected = presets.find((p) => p.key === (value.presetKey || ""));

  return (
    <section style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        <select
          value={value.presetKey || ""}
          onChange={(e) => onChange({ ...value, presetKey: e.target.value || undefined })}
          style={input}
        >
          <option value="">— Choose a starting point —</option>
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>

        {selected && selected.text ? (
          <div style={{ color: "var(--sw-muted)", fontSize: 13, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Preset text</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{selected.text}</div>
            <button
              type="button"
              onClick={() => onChange({ ...value, text: selected.text })}
              style={{ ...btnSecondary, marginTop: 8 }}
            >
              Use preset (overwrite)
            </button>
          </div>
        ) : null}

        <textarea
          value={value.text || ""}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="Draft your own…"
          rows={4}
          style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
        />
      </div>
    </section>
  );
}

function normalizeLegacyRolesFromRanked(intake: Intake) {
  const ranked = ensureRankedRoles(intake);
  const pick = (groups: RankGroup[]) => {
    const flat = groups.map((g) => g.personIds?.[0]).filter(Boolean);
    return {
      primary: flat[0],
      alternate1: flat[1],
      alternate2: flat[2],
    };
  };
  intake.roles = intake.roles || {};
  intake.roles.trustees = pick(ranked.trustees);
  intake.roles.executors = pick(ranked.executors);
  intake.roles.financialAgents = pick(ranked.financialAgents);
  intake.roles.healthAgents = pick(ranked.healthAgents);
  intake.roles.guardians = pick(ranked.guardians);
}

function norm(s: string) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function ensureSpousesExist(intake: Intake) {
  intake.people = Array.isArray(intake.people) ? intake.people : [];
  intake.grantors = Array.isArray(intake.grantors) ? intake.grantors : ["", ""];
  const [g1, g2] = intake.grantors as [string, string];
  const names = [g1, g2].map((x) => x || "");
  const ids: string[] = [];

  for (const name of names) {
    const n = norm(name);
    if (!n) continue;
    let p = intake.people.find((pp: any) => norm(pp?.name || "") === n);
    if (!p) {
      p = { id: newPersonId(), name, email: "", phone: "" };
      intake.people.unshift(p);
    }
    if (p?.id) ids.push(p.id);
  }

  // Return spouse ids only when we have both.
  return ids.length >= 2 ? ids.slice(0, 2) : [];
}

function PeopleEditor({ people, onChange }: { people: any[]; onChange: (p: any[]) => void }) {
  return (
    <section style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>People</div>
      <div style={{ display: "grid", gap: 10 }}>
        {people.map((p, idx) => (
          <div key={p.id} style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr 1fr" }}>
            <input
              value={p.name || ""}
              onChange={(e) => {
                const next = [...people];
                next[idx] = { ...p, name: e.target.value };
                onChange(next);
              }}
              placeholder="Full name"
              style={input}
            />
            <input
              value={p.email || ""}
              onChange={(e) => {
                const next = [...people];
                next[idx] = { ...p, email: e.target.value };
                onChange(next);
              }}
              placeholder="Email (optional)"
              style={input}
            />
            <input
              value={p.phone || ""}
              onChange={(e) => {
                const next = [...people];
                next[idx] = { ...p, phone: e.target.value };
                onChange(next);
              }}
              placeholder="Phone (optional)"
              style={input}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChange([...people, { id: newPersonId(), name: "", email: "", phone: "" }])}
          style={btnSecondary}
        >
          + Add person
        </button>
      </div>
    </section>
  );
}

function RoleRankEditor({
  title,
  people,
  groups,
  onChange,
}: {
  title: string;
  people: any[];
  groups: RankGroup[];
  onChange: (next: RankGroup[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const labelFor = (id: string) => people.find((p) => p.id === id)?.name || "(unnamed)";

  return (
    <section style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {groups.map((g, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx === null || dragIdx === idx) return;
              const next = [...groups];
              const [moved] = next.splice(dragIdx, 1);
              next.splice(idx, 0, moved);
              setDragIdx(null);
              onChange(next);
            }}
            style={{
              padding: 12,
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800 }}>Rank {idx + 1}</div>
              <select
                value={g.actingMode}
                onChange={(e) => {
                  const next = [...groups];
                  next[idx] = { ...g, actingMode: e.target.value as ActingMode };
                  onChange(next);
                }}
                style={{ ...input, maxWidth: 200 }}
              >
                <option value="EITHER">Either may act</option>
                <option value="JOINT">Must act jointly</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const next = [...groups];
                  next.splice(idx, 1);
                  onChange(next);
                }}
                style={btnDanger}
              >
                Remove rank
              </button>
              <div style={{ marginLeft: "auto", color: "var(--sw-muted)", fontSize: 12 }}>
                Drag to reorder
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {(g.personIds || []).map((pid, pidx) => (
                <div key={pidx} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ flex: 1, fontWeight: 700 }}>{labelFor(pid)}</div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...groups];
                      const ids = [...(g.personIds || [])];
                      ids.splice(pidx, 1);
                      next[idx] = { ...g, personIds: ids };
                      onChange(next);
                    }}
                    style={btnSecondary}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const next = [...groups];
                  const ids = Array.from(new Set([...(g.personIds || []), id]));
                  next[idx] = { ...g, personIds: ids };
                  onChange(next);
                }}
                style={{ ...input, minWidth: 280 }}
              >
                <option value="">+ Add co-fiduciary…</option>
                {people
                  .filter((p) => p?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "(unnamed)"}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChange([...groups, { actingMode: "JOINT" as ActingMode, personIds: [] }])}
          style={btnSecondary}
        >
          + Add rank
        </button>
      </div>
    </section>
  );
}

function NotesEditor({
  intake,
  onChange,
}: {
  intake: Intake;
  onChange: (next: Intake) => void;
}) {
  const notes = ensureNotes(intake);
  const sections = notes.sections as Record<string, string>;

  return (
    <section style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Attorney notes (private)</div>
      <div style={{ display: "grid", gap: 12 }}>
        {SECTIONS.map((s) => (
          <label key={s.key} style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "var(--sw-muted)" }}>{s.label}</span>
            <textarea
              value={sections[s.key] || ""}
              onChange={(e) => {
                const next = JSON.parse(JSON.stringify(intake));
                next.__staffNotes = ensureNotes(next);
                next.__staffNotes.sections = next.__staffNotes.sections || {};
                next.__staffNotes.sections[s.key] = e.target.value;
                onChange(next);
              }}
              rows={4}
              style={{
                ...input,
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                resize: "vertical",
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

export function EpisEditorStaffFullClient({ matterId }: { matterId: string }) {
  const [loading, setLoading] = useState(true);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [status, setStatus] = useState<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/matters/${matterId}/epis`, { cache: "no-store" });
      if (!res.ok) {
        setStatus(`Error (${res.status})`);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { intake: any };
      const incoming = data.intake || {};
      incoming.clientEmails = incoming.clientEmails || {};
      incoming.clientPhones = incoming.clientPhones || {};
      incoming.clientAddress = incoming.clientAddress || { street: "", city: "", state: "", zip: "" };
      incoming.people = Array.isArray(incoming.people) ? incoming.people : [];
      incoming.__staffNotes = ensureNotes(incoming);
      incoming.rankedRoles = ensureRankedRoles(incoming);

      // Ensure spouse people exist and add default spouse rank1 across roles.
      const spouseIds = ensureSpousesExist(incoming);
      if (spouseIds.length === 2) {
        const ranked = ensureRankedRoles(incoming);
        const ensure = (arr: RankGroup[]) => {
          if (arr.length && Array.isArray(arr[0]?.personIds)) return arr;
          return [{ actingMode: "EITHER" as ActingMode, personIds: [...spouseIds] }, ...arr];
        };
        incoming.rankedRoles = {
          trustees: ensure(ranked.trustees),
          executors: ensure(ranked.executors),
          financialAgents: ensure(ranked.financialAgents),
          healthAgents: ensure(ranked.healthAgents),
          guardians: ensure(ranked.guardians),
        };
      }

      setIntake(incoming);
      setLoading(false);
    })();
  }, [matterId]);

  function queueSave(nextIntake: any) {
    setIntake(nextIntake);
    setStatus("Unsaved changes…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setStatus("Saving…");
        const toSave = JSON.parse(JSON.stringify(nextIntake));
        normalizeLegacyRolesFromRanked(toSave);
        const res = await fetch(`/api/matters/${matterId}/epis`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intake: toSave }),
        });
        if (!res.ok) {
          setStatus(`Save failed (${res.status})`);
          return;
        }
        const out = (await res.json()) as { updatedAt?: string };
        setLastSavedAt(out.updatedAt ? new Date(out.updatedAt).toLocaleString() : new Date().toLocaleString());
        setStatus("Saved");
      } catch (e: any) {
        setStatus(e?.message || "Save failed");
      }
    }, 600);
  }

  const ranked = useMemo(() => (intake ? ensureRankedRoles(intake) : null), [intake]);
  const wishes = useMemo(() => (intake ? ensureWishes(intake) : null), [intake]);
  const pets = useMemo(() => (intake ? ensurePets(intake) : null), [intake]);
  const advisors = useMemo(() => (intake ? ensureAdvisors(intake) : null), [intake]);
  const assets = useMemo(() => (intake ? ensureAssets(intake) : null), [intake]);

  if (loading) return <div>Loading…</div>;
  if (!intake || !ranked || !wishes || !pets || !advisors || !assets) return <div>{status || "Unable to load."}</div>;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 18px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>EPIS (staff)</h1>
      <div style={{ marginTop: 8, color: "var(--sw-muted)", fontSize: 13 }}>
        Autosave is on. {lastSavedAt ? `Last saved: ${lastSavedAt}.` : ""} {status}
      </div>

      <section style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Client emails</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <input
            value={intake.clientEmails?.client1 || ""}
            onChange={(e) => queueSave({ ...intake, clientEmails: { ...(intake.clientEmails || {}), client1: e.target.value } })}
            placeholder="Spouse 1 email"
            style={input}
          />
          <input
            value={intake.clientEmails?.client2 || ""}
            onChange={(e) => queueSave({ ...intake, clientEmails: { ...(intake.clientEmails || {}), client2: e.target.value } })}
            placeholder="Spouse 2 email"
            style={input}
          />
        </div>
      </section>

      <PeopleEditor
        people={intake.people}
        onChange={(people) => queueSave({ ...intake, people })}
      />

      <RoleRankEditor
        title="Trustees (ranked)"
        people={intake.people}
        groups={ranked.trustees}
        onChange={(groups) => queueSave({ ...intake, rankedRoles: { ...ranked, trustees: groups } })}
      />
      <RoleRankEditor
        title="Executors (ranked)"
        people={intake.people}
        groups={ranked.executors}
        onChange={(groups) => queueSave({ ...intake, rankedRoles: { ...ranked, executors: groups } })}
      />
      <RoleRankEditor
        title="Financial agents (ranked)"
        people={intake.people}
        groups={ranked.financialAgents}
        onChange={(groups) => queueSave({ ...intake, rankedRoles: { ...ranked, financialAgents: groups } })}
      />
      <RoleRankEditor
        title="Health care agents (ranked)"
        people={intake.people}
        groups={ranked.healthAgents}
        onChange={(groups) => queueSave({ ...intake, rankedRoles: { ...ranked, healthAgents: groups } })}
      />
      <RoleRankEditor
        title="Guardians (ranked)"
        people={intake.people}
        groups={ranked.guardians}
        onChange={(groups) => queueSave({ ...intake, rankedRoles: { ...ranked, guardians: groups } })}
      />

      <PresetBlock
        title="Health care wishes — Spouse 1"
        presets={healthcareWishesPresets}
        value={wishes.healthcare.spouse1}
        onChange={(spouse1) => queueSave({ ...intake, wishes: { ...wishes, healthcare: { ...wishes.healthcare, spouse1 } } })}
      />
      <PresetBlock
        title="Health care wishes — Spouse 2"
        presets={healthcareWishesPresets}
        value={wishes.healthcare.spouse2}
        onChange={(spouse2) => queueSave({ ...intake, wishes: { ...wishes, healthcare: { ...wishes.healthcare, spouse2 } } })}
      />

      <PresetBlock
        title="Burial wishes — Spouse 1"
        presets={burialWishesPresets}
        value={wishes.burial.spouse1}
        onChange={(spouse1) => queueSave({ ...intake, wishes: { ...wishes, burial: { ...wishes.burial, spouse1 } } })}
      />
      <PresetBlock
        title="Burial wishes — Spouse 2"
        presets={burialWishesPresets}
        value={wishes.burial.spouse2}
        onChange={(spouse2) => queueSave({ ...intake, wishes: { ...wishes, burial: { ...wishes.burial, spouse2 } } })}
      />

      <PresetBlock
        title="Distribution wishes — Spouse 1"
        presets={distributionWishesPresets}
        value={wishes.distribution.spouse1}
        onChange={(spouse1) => queueSave({ ...intake, wishes: { ...wishes, distribution: { ...wishes.distribution, spouse1 } } })}
      />
      <PresetBlock
        title="Distribution wishes — Spouse 2"
        presets={distributionWishesPresets}
        value={wishes.distribution.spouse2}
        onChange={(spouse2) => queueSave({ ...intake, wishes: { ...wishes, distribution: { ...wishes.distribution, spouse2 } } })}
      />

      <section style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Pets</div>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={pets.hasPets}
            onChange={(e) => queueSave({ ...intake, pets: { ...pets, hasPets: e.target.checked } })}
          />
          <span>Client has pets</span>
        </label>

        {pets.hasPets ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, maxWidth: 240 }}>
              <span style={{ color: "var(--sw-muted)" }}>Number of pets</span>
              <input
                value={String(pets.count || "")}
                onChange={(e) => queueSave({ ...intake, pets: { ...pets, count: Number(e.target.value || 0) } })}
                inputMode="numeric"
                style={input}
              />
            </label>

            <label style={{ display: "grid", gap: 6, maxWidth: 300 }}>
              <span style={{ color: "var(--sw-muted)" }}>$ per pet to caregiver</span>
              <input
                value={moneyCentsToDollars(pets.perPetAmountCents)}
                onChange={(e) =>
                  queueSave({
                    ...intake,
                    pets: { ...pets, perPetAmountCents: moneyDollarsToCents(e.target.value) },
                  })
                }
                inputMode="decimal"
                style={input}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Caregiver</span>
              <select
                value={pets.caregiverPersonId || ""}
                onChange={(e) => queueSave({ ...intake, pets: { ...pets, caregiverPersonId: e.target.value || undefined } })}
                style={input}
              >
                <option value="">—</option>
                {intake.people.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "(unnamed)"}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Alternate caregiver</span>
              <select
                value={pets.alternateCaregiverPersonId || ""}
                onChange={(e) =>
                  queueSave({
                    ...intake,
                    pets: { ...pets, alternateCaregiverPersonId: e.target.value || undefined },
                  })
                }
                style={input}
              >
                <option value="">—</option>
                {intake.people.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "(unnamed)"}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={pets.usePetTrust}
                onChange={(e) => queueSave({ ...intake, pets: { ...pets, usePetTrust: e.target.checked } })}
              />
              <span>Use a pet trust instead</span>
            </label>

            {pets.usePetTrust ? (
              <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                <span style={{ color: "var(--sw-muted)" }}>Pet trust endowment ($)</span>
                <input
                  value={pets.petTrustEndowmentCents ? moneyCentsToDollars(pets.petTrustEndowmentCents) : ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      pets: { ...pets, petTrustEndowmentCents: moneyDollarsToCents(e.target.value) },
                    })
                  }
                  inputMode="decimal"
                  style={input}
                />
              </label>
            ) : null}

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
              <textarea
                value={pets.notes || ""}
                onChange={(e) => queueSave({ ...intake, pets: { ...pets, notes: e.target.value } })}
                rows={3}
                style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Professional advisors</div>

        <div style={{ fontWeight: 800, marginTop: 6 }}>Financial advisor</div>
        <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <input
            value={advisors.financialAdvisor?.name || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, financialAdvisor: { ...(advisors.financialAdvisor || {}), name: e.target.value } } })}
            placeholder="Name"
            style={input}
          />
          <input
            value={advisors.financialAdvisor?.company || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, financialAdvisor: { ...(advisors.financialAdvisor || {}), company: e.target.value } } })}
            placeholder="Company"
            style={input}
          />
          <input
            value={advisors.financialAdvisor?.email || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, financialAdvisor: { ...(advisors.financialAdvisor || {}), email: e.target.value } } })}
            placeholder="Email"
            style={input}
          />
          <input
            value={advisors.financialAdvisor?.phone || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, financialAdvisor: { ...(advisors.financialAdvisor || {}), phone: e.target.value } } })}
            placeholder="Phone"
            style={input}
          />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={Boolean(advisors.financialAdvisor?.okToDiscuss)}
            onChange={(e) =>
              queueSave({
                ...intake,
                advisors: {
                  ...advisors,
                  financialAdvisor: { ...(advisors.financialAdvisor || {}), okToDiscuss: e.target.checked },
                },
              })
            }
          />
          <span>OK to discuss with financial advisor</span>
        </label>

        <div style={{ fontWeight: 800, marginTop: 18 }}>CPA / tax preparer</div>
        <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <input
            value={advisors.cpa?.name || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, cpa: { ...(advisors.cpa || {}), name: e.target.value } } })}
            placeholder="Name"
            style={input}
          />
          <input
            value={advisors.cpa?.company || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, cpa: { ...(advisors.cpa || {}), company: e.target.value } } })}
            placeholder="Company"
            style={input}
          />
          <input
            value={advisors.cpa?.email || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, cpa: { ...(advisors.cpa || {}), email: e.target.value } } })}
            placeholder="Email"
            style={input}
          />
          <input
            value={advisors.cpa?.phone || ""}
            onChange={(e) => queueSave({ ...intake, advisors: { ...advisors, cpa: { ...(advisors.cpa || {}), phone: e.target.value } } })}
            placeholder="Phone"
            style={input}
          />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={Boolean(advisors.cpa?.okToDiscuss)}
            onChange={(e) =>
              queueSave({
                ...intake,
                advisors: {
                  ...advisors,
                  cpa: { ...(advisors.cpa || {}), okToDiscuss: e.target.checked },
                },
              })
            }
          />
          <span>OK to discuss with CPA / tax preparer</span>
        </label>

        <div style={{ fontWeight: 800, marginTop: 18 }}>Other advisors (optional)</div>
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {advisors.other.length ? (
            advisors.other.map((o, idx) => (
              <div
                key={idx}
                style={{
                  padding: 12,
                  borderRadius: "var(--sw-radius-sm)",
                  border: "1px solid var(--sw-border)",
                  background: "rgba(255,255,255,0.03)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>Advisor {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...advisors.other];
                      next.splice(idx, 1);
                      queueSave({ ...intake, advisors: { ...advisors, other: next } });
                    }}
                    style={btnSecondary}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <input
                    value={o.kind || ""}
                    onChange={(e) => {
                      const next = [...advisors.other];
                      next[idx] = { ...o, kind: e.target.value };
                      queueSave({ ...intake, advisors: { ...advisors, other: next } });
                    }}
                    placeholder="Type (e.g., Insurance Agent, Mortgage Lender)"
                    style={input}
                  />
                  <input
                    value={o.name || ""}
                    onChange={(e) => {
                      const next = [...advisors.other];
                      next[idx] = { ...o, name: e.target.value };
                      queueSave({ ...intake, advisors: { ...advisors, other: next } });
                    }}
                    placeholder="Name"
                    style={input}
                  />
                  <input
                    value={o.company || ""}
                    onChange={(e) => {
                      const next = [...advisors.other];
                      next[idx] = { ...o, company: e.target.value };
                      queueSave({ ...intake, advisors: { ...advisors, other: next } });
                    }}
                    placeholder="Company"
                    style={input}
                  />
                  <input
                    value={o.email || ""}
                    onChange={(e) => {
                      const next = [...advisors.other];
                      next[idx] = { ...o, email: e.target.value };
                      queueSave({ ...intake, advisors: { ...advisors, other: next } });
                    }}
                    placeholder="Email"
                    style={input}
                  />
                  <input
                    value={o.phone || ""}
                    onChange={(e) => {
                      const next = [...advisors.other];
                      next[idx] = { ...o, phone: e.target.value };
                      queueSave({ ...intake, advisors: { ...advisors, other: next } });
                    }}
                    placeholder="Phone"
                    style={input}
                  />
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(o.okToDiscuss)}
                    onChange={(e) => {
                      const next = [...advisors.other];
                      next[idx] = { ...o, okToDiscuss: e.target.checked };
                      queueSave({ ...intake, advisors: { ...advisors, other: next } });
                    }}
                  />
                  <span>OK to discuss with this advisor</span>
                </label>
              </div>
            ))
          ) : (
            <div style={{ color: "var(--sw-muted)" }}>None listed.</div>
          )}

          <button
            type="button"
            onClick={() =>
              queueSave({
                ...intake,
                advisors: {
                  ...advisors,
                  other: [
                    ...advisors.other,
                    { kind: "", name: "", company: "", email: "", phone: "", okToDiscuss: false },
                  ],
                },
              })
            }
            style={btnSecondary}
          >
            + Add other advisor
          </button>
        </div>
      </section>

      <section style={card}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Financial assets (MVP)</div>
        <div style={{ color: "var(--sw-muted)", fontSize: 13, lineHeight: 1.4 }}>
          Do <strong>not</strong> enter full account numbers. If helpful, enter only the <strong>last 4 digits</strong>.
          Approximate values are OK.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
          {([
            ["Retirement", "retirement"],
            ["Bank accounts", "bank"],
            ["Brokerage", "brokerage"],
          ] as const).map(([label, key]) => (
            <div key={key} style={{ padding: 12, border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontWeight: 800 }}>{label}</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                  <span style={{ color: "var(--sw-muted)" }}>Approx. total ($)</span>
                  <input
                    value={assets[key].approxTotalCents ? moneyCentsToDollars(assets[key].approxTotalCents!) : ""}
                    onChange={(e) => {
                      const nextAssets = { ...assets, [key]: { ...assets[key], approxTotalCents: moneyDollarsToCents(e.target.value) } };
                      queueSave({ ...intake, assets: nextAssets });
                    }}
                    inputMode="decimal"
                    style={input}
                  />
                </label>

                {assets[key].accounts.map((acct: any, idx: number) => (
                  <div key={idx} style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
                    <input
                      value={acct.institution || ""}
                      onChange={(e) => {
                        const next = [...assets[key].accounts];
                        next[idx] = { ...acct, institution: e.target.value };
                        queueSave({ ...intake, assets: { ...assets, [key]: { ...assets[key], accounts: next } } });
                      }}
                      placeholder="Institution (e.g., Vanguard)"
                      style={input}
                    />
                    <input
                      value={acct.accountType || ""}
                      onChange={(e) => {
                        const next = [...assets[key].accounts];
                        next[idx] = { ...acct, accountType: e.target.value };
                        queueSave({ ...intake, assets: { ...assets, [key]: { ...assets[key], accounts: next } } });
                      }}
                      placeholder="Type (e.g., IRA)"
                      style={input}
                    />
                    <input
                      value={acct.last4 || ""}
                      onChange={(e) => {
                        const next = [...assets[key].accounts];
                        next[idx] = { ...acct, last4: sanitizeLast4(e.target.value) };
                        queueSave({ ...intake, assets: { ...assets, [key]: { ...assets[key], accounts: next } } });
                      }}
                      placeholder="Last 4"
                      inputMode="numeric"
                      maxLength={4}
                      style={input}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const next = [...assets[key].accounts, { institution: "", accountType: "", last4: "", notes: "" }];
                    queueSave({ ...intake, assets: { ...assets, [key]: { ...assets[key], accounts: next } } });
                  }}
                  style={btnSecondary}
                >
                  + Add account
                </button>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
                  <textarea
                    value={assets[key].notes || ""}
                    onChange={(e) => {
                      queueSave({ ...intake, assets: { ...assets, [key]: { ...assets[key], notes: e.target.value } } });
                    }}
                    rows={3}
                    style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                  />
                </label>
              </div>
            </div>
          ))}

          <div style={{ padding: 12, border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontWeight: 800 }}>Real estate</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                <span style={{ color: "var(--sw-muted)" }}>Approx. total ($)</span>
                <input
                  value={assets.realEstate.approxTotalCents ? moneyCentsToDollars(assets.realEstate.approxTotalCents!) : ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, realEstate: { ...assets.realEstate, approxTotalCents: moneyDollarsToCents(e.target.value) } },
                    })
                  }
                  inputMode="decimal"
                  style={input}
                />
              </label>

              {assets.realEstate.properties.map((prop: any, idx: number) => (
                <div key={idx} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr" }}>
                    <input
                      value={prop.address || ""}
                      onChange={(e) => {
                        const next = [...assets.realEstate.properties];
                        next[idx] = { ...prop, address: e.target.value };
                        queueSave({ ...intake, assets: { ...assets, realEstate: { ...assets.realEstate, properties: next } } });
                      }}
                      placeholder="Property address"
                      style={input}
                    />
                    <input
                      value={prop.approxValueCents ? moneyCentsToDollars(prop.approxValueCents) : ""}
                      onChange={(e) => {
                        const next = [...assets.realEstate.properties];
                        next[idx] = { ...prop, approxValueCents: moneyDollarsToCents(e.target.value) };
                        queueSave({ ...intake, assets: { ...assets, realEstate: { ...assets.realEstate, properties: next } } });
                      }}
                      placeholder="Approx. value ($)"
                      inputMode="decimal"
                      style={input}
                    />
                  </div>
                  <textarea
                    value={prop.notes || ""}
                    onChange={(e) => {
                      const next = [...assets.realEstate.properties];
                      next[idx] = { ...prop, notes: e.target.value };
                      queueSave({ ...intake, assets: { ...assets, realEstate: { ...assets.realEstate, properties: next } } });
                    }}
                    placeholder="Notes (e.g., primary residence, rental, how titled)"
                    rows={2}
                    style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const next = [...assets.realEstate.properties, { address: "", notes: "" }];
                  queueSave({ ...intake, assets: { ...assets, realEstate: { ...assets.realEstate, properties: next } } });
                }}
                style={btnSecondary}
              >
                + Add property
              </button>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={Boolean(assets.realEstate.transactionsNext24Months)}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: {
                        ...assets,
                        realEstate: { ...assets.realEstate, transactionsNext24Months: e.target.checked },
                      },
                    })
                  }
                />
                <span>Expect to buy or sell real estate in the next 24 months</span>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
                <textarea
                  value={assets.realEstate.notes || ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, realEstate: { ...assets.realEstate, notes: e.target.value } },
                    })
                  }
                  rows={3}
                  style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                />
              </label>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontWeight: 800 }}>Life insurance</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                <span style={{ color: "var(--sw-muted)" }}>Approx. total death benefit ($)</span>
                <input
                  value={assets.lifeInsurance.approxTotalCents ? moneyCentsToDollars(assets.lifeInsurance.approxTotalCents!) : ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, lifeInsurance: { ...assets.lifeInsurance, approxTotalCents: moneyDollarsToCents(e.target.value) } },
                    })
                  }
                  inputMode="decimal"
                  style={input}
                />
              </label>

              {assets.lifeInsurance.policies.map((pol: any, idx: number) => (
                <div key={idx} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
                    <input
                      value={pol.carrier || ""}
                      onChange={(e) => {
                        const next = [...assets.lifeInsurance.policies];
                        next[idx] = { ...pol, carrier: e.target.value };
                        queueSave({ ...intake, assets: { ...assets, lifeInsurance: { ...assets.lifeInsurance, policies: next } } });
                      }}
                      placeholder="Carrier"
                      style={input}
                    />
                    <input
                      value={pol.last4 || ""}
                      onChange={(e) => {
                        const next = [...assets.lifeInsurance.policies];
                        next[idx] = { ...pol, last4: sanitizeLast4(e.target.value) };
                        queueSave({ ...intake, assets: { ...assets, lifeInsurance: { ...assets.lifeInsurance, policies: next } } });
                      }}
                      placeholder="Policy last 4"
                      inputMode="numeric"
                      maxLength={4}
                      style={input}
                    />
                    <input
                      value={pol.benefitCents ? moneyCentsToDollars(pol.benefitCents) : ""}
                      onChange={(e) => {
                        const next = [...assets.lifeInsurance.policies];
                        next[idx] = { ...pol, benefitCents: moneyDollarsToCents(e.target.value) };
                        queueSave({ ...intake, assets: { ...assets, lifeInsurance: { ...assets.lifeInsurance, policies: next } } });
                      }}
                      placeholder="Benefit ($)"
                      inputMode="decimal"
                      style={input}
                    />
                  </div>
                  <textarea
                    value={pol.notes || ""}
                    onChange={(e) => {
                      const next = [...assets.lifeInsurance.policies];
                      next[idx] = { ...pol, notes: e.target.value };
                      queueSave({ ...intake, assets: { ...assets, lifeInsurance: { ...assets.lifeInsurance, policies: next } } });
                    }}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const next = [...assets.lifeInsurance.policies, { carrier: "", last4: "", notes: "" }];
                  queueSave({ ...intake, assets: { ...assets, lifeInsurance: { ...assets.lifeInsurance, policies: next } } });
                }}
                style={btnSecondary}
              >
                + Add policy
              </button>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
                <textarea
                  value={assets.lifeInsurance.notes || ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, lifeInsurance: { ...assets.lifeInsurance, notes: e.target.value } },
                    })
                  }
                  rows={3}
                  style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                />
              </label>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontWeight: 800 }}>Business interests</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                <span style={{ color: "var(--sw-muted)" }}>Approx. total ($)</span>
                <input
                  value={assets.businessInterests.approxTotalCents ? moneyCentsToDollars(assets.businessInterests.approxTotalCents!) : ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, businessInterests: { ...assets.businessInterests, approxTotalCents: moneyDollarsToCents(e.target.value) } },
                    })
                  }
                  inputMode="decimal"
                  style={input}
                />
              </label>

              {assets.businessInterests.items.map((it: any, idx: number) => (
                <div key={idx} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr" }}>
                    <input
                      value={it.name || ""}
                      onChange={(e) => {
                        const next = [...assets.businessInterests.items];
                        next[idx] = { ...it, name: e.target.value };
                        queueSave({ ...intake, assets: { ...assets, businessInterests: { ...assets.businessInterests, items: next } } });
                      }}
                      placeholder="Business / entity name"
                      style={input}
                    />
                    <input
                      value={it.approxValueCents ? moneyCentsToDollars(it.approxValueCents) : ""}
                      onChange={(e) => {
                        const next = [...assets.businessInterests.items];
                        next[idx] = { ...it, approxValueCents: moneyDollarsToCents(e.target.value) };
                        queueSave({ ...intake, assets: { ...assets, businessInterests: { ...assets.businessInterests, items: next } } });
                      }}
                      placeholder="Approx. value ($)"
                      inputMode="decimal"
                      style={input}
                    />
                  </div>
                  <textarea
                    value={it.notes || ""}
                    onChange={(e) => {
                      const next = [...assets.businessInterests.items];
                      next[idx] = { ...it, notes: e.target.value };
                      queueSave({ ...intake, assets: { ...assets, businessInterests: { ...assets.businessInterests, items: next } } });
                    }}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const next = [...assets.businessInterests.items, { name: "", notes: "" }];
                  queueSave({ ...intake, assets: { ...assets, businessInterests: { ...assets.businessInterests, items: next } } });
                }}
                style={btnSecondary}
              >
                + Add business interest
              </button>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
                <textarea
                  value={assets.businessInterests.notes || ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, businessInterests: { ...assets.businessInterests, notes: e.target.value } },
                    })
                  }
                  rows={3}
                  style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                />
              </label>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontWeight: 800 }}>Vehicles</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                <span style={{ color: "var(--sw-muted)" }}>Approx. total ($)</span>
                <input
                  value={assets.vehicles.approxTotalCents ? moneyCentsToDollars(assets.vehicles.approxTotalCents!) : ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, vehicles: { ...assets.vehicles, approxTotalCents: moneyDollarsToCents(e.target.value) } },
                    })
                  }
                  inputMode="decimal"
                  style={input}
                />
              </label>

              {assets.vehicles.items.map((it: any, idx: number) => (
                <div key={idx} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr" }}>
                    <input
                      value={it.description || ""}
                      onChange={(e) => {
                        const next = [...assets.vehicles.items];
                        next[idx] = { ...it, description: e.target.value };
                        queueSave({ ...intake, assets: { ...assets, vehicles: { ...assets.vehicles, items: next } } });
                      }}
                      placeholder="Description"
                      style={input}
                    />
                    <input
                      value={it.approxValueCents ? moneyCentsToDollars(it.approxValueCents) : ""}
                      onChange={(e) => {
                        const next = [...assets.vehicles.items];
                        next[idx] = { ...it, approxValueCents: moneyDollarsToCents(e.target.value) };
                        queueSave({ ...intake, assets: { ...assets, vehicles: { ...assets.vehicles, items: next } } });
                      }}
                      placeholder="Approx. value ($)"
                      inputMode="decimal"
                      style={input}
                    />
                  </div>
                  <textarea
                    value={it.notes || ""}
                    onChange={(e) => {
                      const next = [...assets.vehicles.items];
                      next[idx] = { ...it, notes: e.target.value };
                      queueSave({ ...intake, assets: { ...assets, vehicles: { ...assets.vehicles, items: next } } });
                    }}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const next = [...assets.vehicles.items, { description: "", notes: "" }];
                  queueSave({ ...intake, assets: { ...assets, vehicles: { ...assets.vehicles, items: next } } });
                }}
                style={btnSecondary}
              >
                + Add vehicle
              </button>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
                <textarea
                  value={assets.vehicles.notes || ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, vehicles: { ...assets.vehicles, notes: e.target.value } },
                    })
                  }
                  rows={3}
                  style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                />
              </label>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontWeight: 800 }}>Personal property / valuables</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                <span style={{ color: "var(--sw-muted)" }}>Approx. total ($)</span>
                <input
                  value={assets.personalProperty.approxTotalCents ? moneyCentsToDollars(assets.personalProperty.approxTotalCents!) : ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, personalProperty: { ...assets.personalProperty, approxTotalCents: moneyDollarsToCents(e.target.value) } },
                    })
                  }
                  inputMode="decimal"
                  style={input}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
                <textarea
                  value={assets.personalProperty.notes || ""}
                  onChange={(e) =>
                    queueSave({
                      ...intake,
                      assets: { ...assets, personalProperty: { ...assets.personalProperty, notes: e.target.value } },
                    })
                  }
                  placeholder="Examples: jewelry, art, firearms, collectibles"
                  rows={3}
                  style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                />
              </label>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontWeight: 800 }}>Alternative / unusual assets</div>
            <div style={{ marginTop: 6, color: "var(--sw-muted)", fontSize: 13 }}>
              For anything nonstandard (collectibles, private placements, crypto, etc.). High-level description only.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
                <span style={{ color: "var(--sw-muted)" }}>Approx. total ($)</span>
                <input
                  value={assets.alternativeAssets.approxTotalCents ? moneyCentsToDollars(assets.alternativeAssets.approxTotalCents!) : ""}
                  onChange={(e) => {
                    queueSave({
                      ...intake,
                      assets: {
                        ...assets,
                        alternativeAssets: {
                          ...assets.alternativeAssets,
                          approxTotalCents: moneyDollarsToCents(e.target.value),
                        },
                      },
                    });
                  }}
                  inputMode="decimal"
                  style={input}
                />
              </label>

              {assets.alternativeAssets.items.map((it: any, idx: number) => (
                <div key={idx} style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr" }}>
                  <input
                    value={it.description || ""}
                    onChange={(e) => {
                      const next = [...assets.alternativeAssets.items];
                      next[idx] = { ...it, description: e.target.value };
                      queueSave({ ...intake, assets: { ...assets, alternativeAssets: { ...assets.alternativeAssets, items: next } } });
                    }}
                    placeholder="Description (e.g., baseball card collection)"
                    style={input}
                  />
                  <input
                    value={it.approxValueCents ? moneyCentsToDollars(it.approxValueCents) : ""}
                    onChange={(e) => {
                      const next = [...assets.alternativeAssets.items];
                      next[idx] = { ...it, approxValueCents: moneyDollarsToCents(e.target.value) };
                      queueSave({ ...intake, assets: { ...assets, alternativeAssets: { ...assets.alternativeAssets, items: next } } });
                    }}
                    placeholder="Approx. value ($)"
                    inputMode="decimal"
                    style={input}
                  />
                  <textarea
                    value={it.notes || ""}
                    onChange={(e) => {
                      const next = [...assets.alternativeAssets.items];
                      next[idx] = { ...it, notes: e.target.value };
                      queueSave({ ...intake, assets: { ...assets, alternativeAssets: { ...assets.alternativeAssets, items: next } } });
                    }}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ ...input, gridColumn: "1 / -1", fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const next = [...assets.alternativeAssets.items, { description: "", notes: "" }];
                  queueSave({ ...intake, assets: { ...assets, alternativeAssets: { ...assets.alternativeAssets, items: next } } });
                }}
                style={btnSecondary}
              >
                + Add alternative asset
              </button>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>Notes (optional)</span>
                <textarea
                  value={assets.alternativeAssets.notes || ""}
                  onChange={(e) => {
                    queueSave({ ...intake, assets: { ...assets, alternativeAssets: { ...assets.alternativeAssets, notes: e.target.value } } });
                  }}
                  rows={3}
                  style={{ ...input, fontFamily: "ui-sans-serif, system-ui, -apple-system", resize: "vertical" }}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <NotesEditor intake={intake} onChange={queueSave} />
    </main>
  );
}

const card: React.CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: "var(--sw-radius)",
  background: "var(--sw-card)",
  border: "1px solid var(--sw-border)",
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid var(--sw-border)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--sw-text)",
  outline: "none",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid var(--sw-border)",
  background: "rgba(255,255,255,0.04)",
  fontWeight: 700,
  color: "var(--sw-text)",
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid rgba(239, 68, 68, 0.45)",
  background: "rgba(239, 68, 68, 0.08)",
  fontWeight: 800,
  color: "var(--sw-text)",
  cursor: "pointer",
};
