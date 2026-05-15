"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useUnsavedChanges } from "@/components/unsaved/UnsavedChangesProvider";

type Child = { name: string; dob: string };

type Offering =
  | "JOINT_TRUST"
  | "INDIVIDUAL_TRUST"
  | "RECIPROCAL_TRUSTS"
  | "WILL_ONLY"
  | "WILL_AND_INCAPACITY"
  | "INCAPACITY_ONLY";

type DistributionScheme =
  | "standard-per-stirpes-ni21-row-25-30-halves"
  | "bloodline-residual";

type Person = {
  id: string;
  name: string;
  /**
   * Legacy bare relationship label (e.g. "brother", "friend").
   * Prefer the relationshipPhrase* fields for drafting.
   */
  relationship?: string;

  /** Drafting phrases that already include the right determiner/possessive. */
  relationshipPhraseToSpouse1?: string; // e.g. "my brother"
  relationshipPhraseToSpouse2?: string; // e.g. "my brother-in-law"
  relationshipPhraseJoint?: string; // e.g. "John's brother" or "our friend"

  email?: string;
  phone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
};

type RoleAssignment = {
  primary?: string;
  alternate1?: string;
  alternate2?: string;
};

type RoleAssignmentByClient = {
  client1: RoleAssignment;
  client2: RoleAssignment;
};

function newId() {
  return `p_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function PersonSelect({
  label,
  people,
  value,
  onChange,
}: {
  label: string;
  people: Person[];
  value?: string;
  onChange: (id: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--sw-muted)" }}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">—</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoleBlock({
  title,
  people,
  value,
  onChange,
}: {
  title: string;
  people: Person[];
  value: RoleAssignment;
  onChange: (next: RoleAssignment) => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <RoleFields people={people} value={value} onChange={onChange} />
    </section>
  );
}

function RoleFields({
  people,
  value,
  onChange,
}: {
  people: Person[];
  value: RoleAssignment;
  onChange: (next: RoleAssignment) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      <PersonSelect
        label="Primary"
        people={people}
        value={value.primary}
        onChange={(id) => onChange({ ...value, primary: id || undefined })}
      />
      <PersonSelect
        label="Alternate 1"
        people={people}
        value={value.alternate1}
        onChange={(id) => onChange({ ...value, alternate1: id || undefined })}
      />
      <PersonSelect
        label="Alternate 2"
        people={people}
        value={value.alternate2}
        onChange={(id) => onChange({ ...value, alternate2: id || undefined })}
      />
    </div>
  );
}

function RoleBlockByClient({
  title,
  client1Label,
  client2Label,
  people,
  value,
  onChange,
}: {
  title: string;
  client1Label: string;
  client2Label: string;
  people: Person[];
  value: RoleAssignmentByClient;
  onChange: (next: RoleAssignmentByClient) => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{client1Label}</div>
          <RoleFields
            people={people}
            value={value.client1}
            onChange={(client1) => onChange({ ...value, client1 })}
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{client2Label}</div>
          <RoleFields
            people={people}
            value={value.client2}
            onChange={(client2) => onChange({ ...value, client2 })}
          />
        </div>
      </div>
    </section>
  );
}

function OrderedAppointeesByClient({
  title,
  client1Label,
  client2Label,
  people,
  value,
  onChange,
}: {
  title: string;
  client1Label: string;
  client2Label: string;
  people: Person[];
  value: { client1: string[]; client2: string[] };
  onChange: (next: { client1: string[]; client2: string[] }) => void;
}) {
  const labelFor = (id: string) => people.find((p) => p.id === id)?.name || "(unnamed)";

  const Block = ({
    label,
    ids,
    setIds,
  }: {
    label: string;
    ids: string[];
    setIds: (next: string[]) => void;
  }) => (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>{label}</div>

      {ids.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {ids.map((id, idx) => (
            <div key={`${id}_${idx}`} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>
                {idx === 0 ? "Primary: " : `Alternate ${idx}: `}
                {labelFor(id)}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = [...ids];
                  next.splice(idx, 1);
                  setIds(next);
                }}
                style={secondaryBtn}
              >
                Remove
              </button>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => {
                  if (idx === 0) return;
                  const next = [...ids];
                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                  setIds(next);
                }}
                style={{ ...secondaryBtn, opacity: idx === 0 ? 0.5 : 1 }}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === ids.length - 1}
                onClick={() => {
                  if (idx >= ids.length - 1) return;
                  const next = [...ids];
                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                  setIds(next);
                }}
                style={{ ...secondaryBtn, opacity: idx === ids.length - 1 ? 0.5 : 1 }}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "var(--sw-muted)" }}>No one selected.</div>
      )}

      <select
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          if (ids.includes(id)) return;
          setIds([...ids, id]);
        }}
        style={inputStyle}
      >
        <option value="">+ Add person…</option>
        {people
          .filter((p) => p?.id)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "(unnamed)"}
            </option>
          ))}
      </select>
    </div>
  );

  return (
    <section style={cardStyle}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 18 }}>
        <Block
          label={client1Label}
          ids={value.client1}
          setIds={(client1) => onChange({ ...value, client1 })}
        />
        <Block
          label={client2Label}
          ids={value.client2}
          setIds={(client2) => onChange({ ...value, client2 })}
        />
      </div>
    </section>
  );
}

function CoAgentRanksByClient({
  title,
  client1Label,
  client2Label,
  people,
  value,
  onChange,
}: {
  title: string;
  client1Label: string;
  client2Label: string;
  people: Person[];
  value: { client1: string[][]; client2: string[][] };
  onChange: (next: { client1: string[][]; client2: string[][] }) => void;
}) {
  const labelFor = (id: string) => people.find((p) => p.id === id)?.name || "(unnamed)";

  const RankBlock = ({
    label,
    ranks,
    setRanks,
  }: {
    label: string;
    ranks: string[][];
    setRanks: (next: string[][]) => void;
  }) => (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>{label}</div>

      <div style={{ display: "grid", gap: 10 }}>
        {(ranks.length ? ranks : [[]]).map((rankIds, idx) => (
          <div
            key={idx}
            style={{
              padding: 12,
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800 }}>
                {idx === 0 ? "Representative" : `Successor ${idx}`}
              </div>
              {idx > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...ranks];
                    next.splice(idx, 1);
                    setRanks(next.length ? next : [[]]);
                  }}
                  style={dangerBtn}
                >
                  Remove successor
                </button>
              ) : null}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => {
                    if (idx === 0) return;
                    const next = [...ranks];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    setRanks(next);
                  }}
                  style={{ ...secondaryBtn, opacity: idx === 0 ? 0.5 : 1 }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx >= ranks.length - 1}
                  onClick={() => {
                    if (idx >= ranks.length - 1) return;
                    const next = [...ranks];
                    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                    setRanks(next);
                  }}
                  style={{ ...secondaryBtn, opacity: idx >= ranks.length - 1 ? 0.5 : 1 }}
                >
                  ↓
                </button>
              </div>
            </div>

            {rankIds.length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {rankIds.map((id, pidx) => (
                  <div key={`${id}_${pidx}`} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ flex: 1, fontWeight: 700 }}>{labelFor(id)}</div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...ranks];
                        const ids = [...(next[idx] || [])];
                        ids.splice(pidx, 1);
                        next[idx] = ids;
                        setRanks(next);
                      }}
                      style={secondaryBtn}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 10, color: "var(--sw-muted)" }}>No one selected.</div>
            )}

            <div style={{ marginTop: 10 }}>
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const next = [...ranks];
                  const ids = Array.from(new Set([...(next[idx] || []), id]));
                  next[idx] = ids;
                  setRanks(next);
                }}
                style={inputStyle}
              >
                <option value="">+ Add co-agent…</option>
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
          onClick={() => setRanks([...(ranks.length ? ranks : [[]]), []])}
          style={secondaryBtn}
        >
          + Add successor rank
        </button>
      </div>
    </div>
  );

  return (
    <section style={cardStyle}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 18 }}>
        <RankBlock
          label={client1Label}
          ranks={value.client1}
          setRanks={(client1) => onChange({ ...value, client1 })}
        />
        <RankBlock
          label={client2Label}
          ranks={value.client2}
          setRanks={(client2) => onChange({ ...value, client2 })}
        />
      </div>
    </section>
  );
}

export function NewMatterForm() {
  const unsaved = useUnsavedChanges();
  const [draftMatterId, setDraftMatterId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const lastSavedSnapshot = useRef<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [offering, setOffering] = useState<Offering>("JOINT_TRUST");
  const [grantor1, setGrantor1] = useState("");
  const [grantor2, setGrantor2] = useState("");

  // Required address (shared household address for MVP)
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("VA");
  const [zip, setZip] = useState("");

  const [client1Email, setClient1Email] = useState("");
  const [client2Email, setClient2Email] = useState("");
  const [client1Phone, setClient1Phone] = useState("");
  const [client2Phone, setClient2Phone] = useState("");

  const [trustNameOverride, setTrustNameOverride] = useState("");

  // Reciprocal trusts: per-client trust display names (labels for each individual trust).
  const [reciprocalTrustDisplayNameClient1, setReciprocalTrustDisplayNameClient1] = useState("");
  const [reciprocalTrustDisplayNameClient2, setReciprocalTrustDisplayNameClient2] = useState("");

  const [children, setChildren] = useState<Child[]>([]);
  const [hasMinorChildren, setHasMinorChildren] = useState(false);

  // People cards
  const [people, setPeople] = useState<Person[]>([
    {
      id: newId(),
      name: "",
      relationship: "",
      relationshipPhraseToSpouse1: "",
      relationshipPhraseToSpouse2: "",
      relationshipPhraseJoint: "",
      email: "",
      phone: "",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      addressZip: "",
    },
  ]);

  // Role assignments (store person IDs)
  const [trustees, setTrustees] = useState<RoleAssignmentByClient>({ client1: {}, client2: {} });
  const [executors, setExecutors] = useState<RoleAssignmentByClient>({ client1: {}, client2: {} });
  const [financialAgents, setFinancialAgents] = useState<RoleAssignmentByClient>({ client1: {}, client2: {} });
  const [healthAgents, setHealthAgents] = useState<RoleAssignmentByClient>({ client1: {}, client2: {} });
  const [finalDispositionAgents, setFinalDispositionAgents] = useState<{ client1: string[][]; client2: string[][] }>({
    client1: [[]],
    client2: [[]],
  });
  const [guardians, setGuardians] = useState<RoleAssignment>({});

  // legacy fields from v0; replaced by People + Role slots
  const [scheme, setScheme] = useState<DistributionScheme>(
    "standard-per-stirpes-ni21-row-25-30-halves"
  );

  const canSubmit = useMemo(() => {
    return (
      grantor1.trim() &&
      grantor2.trim() &&
      street.trim() &&
      city.trim() &&
      state.trim() &&
      zip.trim()
    );
  }, [grantor1, grantor2, street, city, state, zip]);

  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "done"; matterId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const intakePayload = useMemo(() => {
    const reciprocalNames = {
      client1: reciprocalTrustDisplayNameClient1.trim() || undefined,
      client2: reciprocalTrustDisplayNameClient2.trim() || undefined,
    };

    return {
      offering,
      // Back-compat: older saved intakes used matterType.
      matterType: offering,
      grantors: [grantor1.trim(), grantor2.trim()],
      hasMinorChildren,
      clientAddress: {
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
      },
      clientEmails: {
        client1: client1Email.trim() || undefined,
        client2: client2Email.trim() || undefined,
      },
      clientPhones: {
        client1: client1Phone.trim() || undefined,
        client2: client2Phone.trim() || undefined,
      },
      trustNameOverride: trustNameOverride.trim() || undefined,
      reciprocalTrustDisplayNames:
        offering === "RECIPROCAL_TRUSTS" && (reciprocalNames.client1 || reciprocalNames.client2)
          ? reciprocalNames
          : undefined,
      people,
      roles: {
        trustees,
        executors,
        financialAgents,
        healthAgents,
        finalDispositionAgents,
        guardians,
      },
      children: children
        .map((c) => ({ name: c.name.trim(), dob: c.dob || undefined }))
        .filter((c) => c.name),
      successorTrustees: [],
      distributionScheme: scheme,
    };
  }, [
    offering,
    grantor1,
    grantor2,
    hasMinorChildren,
    street,
    city,
    state,
    zip,
    client1Email,
    client2Email,
    client1Phone,
    client2Phone,
    trustNameOverride,
    reciprocalTrustDisplayNameClient1,
    reciprocalTrustDisplayNameClient2,
    people,
    trustees,
    executors,
    financialAgents,
    healthAgents,
    finalDispositionAgents,
    guardians,
    children,
    scheme,
  ]);

  const snapshot = useMemo(() => {
    return JSON.stringify({
      displayName,
      grantor1,
      grantor2,
      street,
      city,
      state,
      zip,
      client1Email,
      client2Email,
      client1Phone,
      client2Phone,
      trustNameOverride,
      reciprocalTrustDisplayNameClient1,
      reciprocalTrustDisplayNameClient2,
      hasMinorChildren,
      people,
      trustees,
      executors,
      financialAgents,
      healthAgents,
      finalDispositionAgents,
      guardians,
      children,
      scheme,
      offering,
    });
  }, [
    displayName,
    grantor1,
    grantor2,
    street,
    city,
    state,
    zip,
    client1Email,
    client2Email,
    client1Phone,
    client2Phone,
    trustNameOverride,
    reciprocalTrustDisplayNameClient1,
    reciprocalTrustDisplayNameClient2,
    hasMinorChildren,
      people,
      trustees,
      executors,
      financialAgents,
      healthAgents,
      finalDispositionAgents,
      guardians,
    children,
    scheme,
    offering,
  ]);

  useEffect(() => {
    if (lastSavedSnapshot.current === null) {
      lastSavedSnapshot.current = snapshot;
      return;
    }
    setDirty(snapshot !== lastSavedSnapshot.current);
  }, [snapshot]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      // Required for Chrome
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const saveProgress = useCallback(async () => {
    setStatus({ kind: "saving" });

    const computedDisplayName =
      displayName.trim() || `${grantor1} + ${grantor2} (Joint Trust)`;

    if (!draftMatterId) {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: computedDisplayName,
          intake: intakePayload,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setStatus({ kind: "error", message: txt || `HTTP ${res.status}` });
        return;
      }

      const data = (await res.json()) as { matterId: string };
      setDraftMatterId(data.matterId);
      lastSavedSnapshot.current = snapshot;
      setDirty(false);
      setStatus({ kind: "done", matterId: data.matterId });
      return;
    }

    const res = await fetch(`/api/matters/${draftMatterId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: computedDisplayName,
        intake: intakePayload,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setStatus({ kind: "error", message: txt || `HTTP ${res.status}` });
      return;
    }

    const data = (await res.json()) as { matterId: string };
    lastSavedSnapshot.current = snapshot;
    setDirty(false);
    setStatus({ kind: "done", matterId: data.matterId });
  }, [displayName, draftMatterId, grantor1, grantor2, intakePayload, snapshot]);

  useEffect(() => {
    unsaved.setDirty(dirty);
    unsaved.registerSaveFn(dirty ? saveProgress : null);
    return () => {
      unsaved.setDirty(false);
      unsaved.registerSaveFn(null);
    };
  }, [dirty, saveProgress, unsaved]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });

    const res = await fetch("/api/matters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName:
          displayName.trim() || `${grantor1} + ${grantor2} (Joint Trust)`,
        intake: intakePayload,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setStatus({ kind: "error", message: txt || `HTTP ${res.status}` });
      return;
    }

    const data = (await res.json()) as { matterId: string };
    setDraftMatterId(data.matterId);
    lastSavedSnapshot.current = snapshot;
    setDirty(false);
    setStatus({ kind: "done", matterId: data.matterId });
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "44px 18px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>New matter (MVP)</h1>
      <p style={{ marginTop: 10, color: "var(--sw-muted)", maxWidth: 760 }}>
        MVP intake: address + people + role assignments.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 18, display: "grid", gap: 14 }}>
        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Matter</div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Offering</span>
              <select value={offering} onChange={(e) => setOffering(e.target.value as Offering)} style={inputStyle}>
                <option value="JOINT_TRUST">Joint trust (packet)</option>
                <option value="INDIVIDUAL_TRUST">Individual trust (packet)</option>
                <option value="RECIPROCAL_TRUSTS">Reciprocal individual trusts (packet)</option>
                <option value="WILL_ONLY">Wills only</option>
                <option value="WILL_AND_INCAPACITY">Wills + incapacity docs</option>
                <option value="INCAPACITY_ONLY">Incapacity docs only</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Display name (optional)</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Doe + Doe (Joint Trust)"
                style={inputStyle}
              />
            </label>
          </div>

          {offering === "RECIPROCAL_TRUSTS" ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Reciprocal trust display names</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ color: "var(--sw-muted)" }}>
                    Client 1 trust display name (optional)
                  </span>
                  <input
                    value={reciprocalTrustDisplayNameClient1}
                    onChange={(e) => setReciprocalTrustDisplayNameClient1(e.target.value)}
                    placeholder={`${grantor1 || "Client 1"} (Individual Trust)`.trim()}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ color: "var(--sw-muted)" }}>
                    Client 2 trust display name (optional)
                  </span>
                  <input
                    value={reciprocalTrustDisplayNameClient2}
                    onChange={(e) => setReciprocalTrustDisplayNameClient2(e.target.value)}
                    placeholder={`${grantor2 || "Client 2"} (Individual Trust)`.trim()}
                    style={inputStyle}
                  />
                </label>
              </div>
              <p style={{ marginTop: 8, marginBottom: 0, color: "var(--sw-muted)", fontSize: 12 }}>
                These label the two individual trusts within a reciprocal-trust matter.
              </p>
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Grantors</div>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Grantor 1</span>
              <input
                value={grantor1}
                onChange={(e) => setGrantor1(e.target.value)}
                style={inputStyle}
                required
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Grantor 2</span>
              <input
                value={grantor2}
                onChange={(e) => setGrantor2(e.target.value)}
                style={inputStyle}
                required
              />
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Household address (required)</div>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Street</span>
              <input value={street} onChange={(e) => setStreet(e.target.value)} style={inputStyle} required />
            </label>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>City</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} required />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>State</span>
                <input value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} required />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "var(--sw-muted)" }}>Zip</span>
                <input value={zip} onChange={(e) => setZip(e.target.value)} style={inputStyle} required />
              </label>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Client contact (required for POAs)</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Client 1 email</span>
              <input value={client1Email} onChange={(e) => setClient1Email(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Client 2 email</span>
              <input value={client2Email} onChange={(e) => setClient2Email(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Client 1 phone</span>
              <input value={client1Phone} onChange={(e) => setClient1Phone(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Client 2 phone</span>
              <input value={client2Phone} onChange={(e) => setClient2Phone(e.target.value)} style={inputStyle} />
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Trust name (optional override)</div>
          <label style={{ display: "grid", gap: 6, maxWidth: 640 }}>
            <span style={{ color: "var(--sw-muted)" }}>Trust name override</span>
            <input
              value={trustNameOverride}
              onChange={(e) => setTrustNameOverride(e.target.value)}
              placeholder="THE DOE FAMILY LIVING TRUST"
              style={inputStyle}
            />
          </label>
          <p style={{ marginTop: 8, marginBottom: 0, color: "var(--sw-muted)", fontSize: 12 }}>
            If blank, the system will default to “THE [Client 1 surname] FAMILY LIVING TRUST”.
          </p>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Children (optional)</div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={hasMinorChildren}
              onChange={(e) => setHasMinorChildren(e.target.checked)}
            />
            <span style={{ color: "var(--sw-muted)" }}>Has minor children (include minors docs)</span>
          </label>
          <div style={{ display: "grid", gap: 10 }}>
            {children.length ? (
              children.map((c, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    value={c.name}
                    onChange={(e) =>
                      setChildren((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                      )
                    }
                    placeholder={`Child  full name`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    value={c.dob}
                    onChange={(e) =>
                      setChildren((prev) => prev.map((x, i) => (i === idx ? { ...x, dob: e.target.value } : x)))
                    }
                    placeholder="YYYY-MM-DD"
                    style={{ ...inputStyle, width: 160 }}
                  />
                  <button
                    type="button"
                    onClick={() => setChildren((prev) => prev.filter((_, i) => i !== idx))}
                    style={secondaryBtn}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--sw-muted)" }}>No children added.</div>
            )}
            <div>
              <button
                type="button"
                onClick={() => setChildren((p) => [...p, { name: "", dob: "" }])}
                style={secondaryBtn}
              >
                + Add child
              </button>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>People (cards)</div>
          <p style={{ marginTop: 0, color: "var(--sw-muted)", fontSize: 12 }}>
            Add people once, then assign them to roles below.
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            {people.length ? (
              people.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: "var(--sw-radius-sm)",
                    border: "1px solid var(--sw-border)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{p.name || "(unnamed)"}</div>
                    <button
                      type="button"
                      onClick={() => setPeople((prev) => prev.filter((x) => x.id !== p.id))}
                      style={secondaryBtn}
                    >
                      Remove
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>Name</span>
                      <input
                        value={p.name}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>Relationship (optional)</span>
                      <input
                        value={p.relationship ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, relationship: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>
                        Relationship phrase (Client 1 POV)
                      </span>
                      <input
                        value={p.relationshipPhraseToSpouse1 ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) =>
                              x.id === p.id
                                ? { ...x, relationshipPhraseToSpouse1: e.target.value }
                                : x
                            )
                          )
                        }
                        placeholder='e.g., "my brother"'
                        style={inputStyle}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>
                        Relationship phrase (Client 2 POV)
                      </span>
                      <input
                        value={p.relationshipPhraseToSpouse2 ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) =>
                              x.id === p.id
                                ? { ...x, relationshipPhraseToSpouse2: e.target.value }
                                : x
                            )
                          )
                        }
                        placeholder='e.g., "my brother-in-law"'
                        style={inputStyle}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>
                        Relationship phrase (joint docs)
                      </span>
                      <input
                        value={p.relationshipPhraseJoint ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) =>
                              x.id === p.id
                                ? { ...x, relationshipPhraseJoint: e.target.value }
                                : x
                            )
                          )
                        }
                        placeholder={`e.g., "our friend" or "John's brother"`}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>Email</span>
                      <input
                        value={p.email ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, email: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>Phone</span>
                      <input
                        value={p.phone ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, phone: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>Street</span>
                      <input
                        value={p.addressStreet ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, addressStreet: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>City</span>
                      <input
                        value={p.addressCity ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, addressCity: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>State</span>
                      <input
                        value={p.addressState ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, addressState: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>Zip</span>
                      <input
                        value={p.addressZip ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, addressZip: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--sw-muted)" }}>No people added.</div>
            )}

            <div>
              <button
                type="button"
                onClick={() =>
                  setPeople((prev) => [
                    ...prev,
                    {
                      id: newId(),
                      name: "",
                    },
                  ])
                }
                style={secondaryBtn}
              >
                + Add person
              </button>
            </div>
          </div>
        </section>

        <RoleBlockByClient
          title="Trustees / successor trustees"
          client1Label={grantor1.trim() ? `Client 1 — ${grantor1.trim()}` : "Client 1"}
          client2Label={grantor2.trim() ? `Client 2 — ${grantor2.trim()}` : "Client 2"}
          people={people}
          value={trustees}
          onChange={setTrustees}
        />
        <RoleBlockByClient
          title="Executors / wills"
          client1Label={grantor1.trim() ? `Client 1 — ${grantor1.trim()}` : "Client 1"}
          client2Label={grantor2.trim() ? `Client 2 — ${grantor2.trim()}` : "Client 2"}
          people={people}
          value={executors}
          onChange={setExecutors}
        />
        <RoleBlockByClient
          title="Financial agents / GDPOA"
          client1Label={grantor1.trim() ? `Client 1 — ${grantor1.trim()}` : "Client 1"}
          client2Label={grantor2.trim() ? `Client 2 — ${grantor2.trim()}` : "Client 2"}
          people={people}
          value={financialAgents}
          onChange={setFinancialAgents}
        />
        <RoleBlockByClient
          title="Health care agents / AMD"
          client1Label={grantor1.trim() ? `Client 1 — ${grantor1.trim()}` : "Client 1"}
          client2Label={grantor2.trim() ? `Client 2 — ${grantor2.trim()}` : "Client 2"}
          people={people}
          value={healthAgents}
          onChange={setHealthAgents}
        />

        <CoAgentRanksByClient
          title="Final disposition agents"
          client1Label={grantor1.trim() ? `Client 1 — ${grantor1.trim()}` : "Client 1"}
          client2Label={grantor2.trim() ? `Client 2 — ${grantor2.trim()}` : "Client 2"}
          people={people}
          value={finalDispositionAgents}
          onChange={setFinalDispositionAgents}
        />
        {hasMinorChildren ? (
          <RoleBlock title="Guardians (minors only)" people={people} value={guardians} onChange={setGuardians} />
        ) : null}

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Distribution scheme</div>
          <label style={{ display: "grid", gap: 6, maxWidth: 520 }}>
            <span style={{ color: "var(--sw-muted)" }}>Scheme</span>
            <select
              value={scheme}
              onChange={(e) => setScheme(e.target.value as DistributionScheme)}
              style={inputStyle}
            >
              <option value="standard-per-stirpes-ni21-row-25-30-halves">
                NI @ 21 + ROW 1/2 @ 25 and 1/2 @ 30
              </option>
              <option value="bloodline-residual">Bloodline trust residual</option>
            </select>
          </label>
        </section>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={saveProgress}
            disabled={status.kind === "saving" || !dirty}
            style={{
              ...secondaryBtn,
              opacity: status.kind === "saving" || !dirty ? 0.6 : 1,
              cursor: status.kind === "saving" || !dirty ? "not-allowed" : "pointer",
            }}
          >
            Save progress
          </button>

          <button
            type="submit"
            disabled={!canSubmit || status.kind === "saving"}
            style={{
              ...primaryBtn,
              opacity: !canSubmit || status.kind === "saving" ? 0.6 : 1,
              cursor:
                !canSubmit || status.kind === "saving" ? "not-allowed" : "pointer",
            }}
          >
            {status.kind === "saving" ? "Creating…" : "Create matter"}
          </button>

          {dirty ? (
            <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>
              Unsaved changes
            </span>
          ) : null}

          {status.kind === "done" ? (
            <a
              href={`/matters/${status.matterId}`}
              style={{ ...secondaryBtn, textDecoration: "none" }}
            >
              Open matter →
            </a>
          ) : null}

          {status.kind === "error" ? (
            <span style={{ color: "var(--sw-danger)" }}>{status.message}</span>
          ) : null}
        </div>
      </form>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: "var(--sw-radius)",
  background: "var(--sw-card)",
  border: "1px solid var(--sw-border)",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid var(--sw-border)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--sw-text)",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid rgba(110,231,255,0.45)",
  background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
  fontWeight: 800,
  color: "var(--sw-text)",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid var(--sw-border)",
  background: "rgba(255,255,255,0.04)",
  fontWeight: 700,
  color: "var(--sw-text)",
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  ...secondaryBtn,
  border: "1px solid rgba(255, 80, 80, 0.5)",
  background: "rgba(255,80,80,0.08)",
};
