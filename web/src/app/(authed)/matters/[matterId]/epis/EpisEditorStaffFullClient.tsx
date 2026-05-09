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

  if (loading) return <div>Loading…</div>;
  if (!intake || !ranked || !wishes) return <div>{status || "Unable to load."}</div>;

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
