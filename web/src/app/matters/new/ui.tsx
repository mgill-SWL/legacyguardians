"use client";

import { FormEvent, useMemo, useState } from "react";

type Child = { name: string; dob: string };

type MatterType =
  | "JOINT_TRUST"
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
  relationship?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type RoleAssignment = {
  primary?: string;
  alternate1?: string;
  alternate2?: string;
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
    </section>
  );
}

export function NewMatterForm() {
  const [displayName, setDisplayName] = useState("");
  const [matterType, setMatterType] = useState<MatterType>("JOINT_TRUST");
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

  const [children, setChildren] = useState<Child[]>([]);
  const [hasMinorChildren, setHasMinorChildren] = useState(false);

  // People cards
  const [people, setPeople] = useState<Person[]>([
    {
      id: newId(),
      name: "",
      relationship: "",
      email: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zip: "",
    },
  ]);

  // Role assignments (store person IDs)
  const [trustees, setTrustees] = useState<RoleAssignment>({});
  const [executors, setExecutors] = useState<RoleAssignment>({});
  const [financialAgents, setFinancialAgents] = useState<RoleAssignment>({});
  const [healthAgents, setHealthAgents] = useState<RoleAssignment>({});
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });

    const res = await fetch("/api/matters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName:
          displayName.trim() || `${grantor1} + ${grantor2} (Joint Trust)`,
        intake: {
          matterType,
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
          people,
          roles: {
            trustees,
            executors,
            financialAgents,
            healthAgents,
            guardians,
          },
          children: children.map((c) => ({ name: c.name.trim(), dob: c.dob || undefined })).filter((c) => c.name),
          successorTrustees: [],
          distributionScheme: scheme,
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setStatus({ kind: "error", message: txt || `HTTP ${res.status}` });
      return;
    }

    const data = (await res.json()) as { matterId: string };
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
              <select value={matterType} onChange={(e) => setMatterType(e.target.value as MatterType)} style={inputStyle}>
                <option value="JOINT_TRUST">Joint trust (packet)</option>
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
                        value={p.street ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, street: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>City</span>
                      <input
                        value={p.city ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, city: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>State</span>
                      <input
                        value={p.state ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, state: e.target.value } : x))
                          )
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: "var(--sw-muted)" }}>Zip</span>
                      <input
                        value={p.zip ?? ""}
                        onChange={(e) =>
                          setPeople((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, zip: e.target.value } : x))
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

        <RoleBlock title="Trustees (successor trustees)" people={people} value={trustees} onChange={setTrustees} />
        <RoleBlock title="Executors (wills)" people={people} value={executors} onChange={setExecutors} />
        <RoleBlock title="Financial agents (GDPOA)" people={people} value={financialAgents} onChange={setFinancialAgents} />
        <RoleBlock title="Health care agents (AMD)" people={people} value={healthAgents} onChange={setHealthAgents} />
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
