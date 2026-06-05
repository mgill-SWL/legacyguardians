"use client";

import { useMemo, useState } from "react";

type Assignee = {
  id: string;
  googleEmail: string;
  displayName: string | null;
  timeZone: string;
  weekdayStartMin: number;
  weekdayEndMin: number;
  enabled: boolean;
};

type TypeRow = {
  id: string;
  slug: string;
  name: string;
  durationMin: number;
  startIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeHours: number;
  rollingWeeks: number;
  maxPerDay: number;
  assignees: Assignee[];
  updatedAt: string;
};

const MIN_NOTICE_OPTIONS = [
  { value: 0, label: "No advance notice - next top of the hour" },
  { value: 1, label: "1 hour" },
  { value: 6, label: "6 hours" },
  { value: 24, label: "24 hours" },
];

function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmToMinutes(v: string) {
  const [hh, mm] = v.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 9 * 60;
  return hh * 60 + mm;
}

export function BookingAdminClient({
  initialTypes,
  googleEmails,
  canEdit,
}: {
  initialTypes: any[];
  googleEmails: string[];
  canEdit: boolean;
}) {
  const types: TypeRow[] = (initialTypes || []).map((t) => ({
    ...t,
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : new Date(t.updatedAt).toISOString(),
  }));

  const [selectedId, setSelectedId] = useState<string | null>(types[0]?.id || null);
  const selected = useMemo(() => types.find((t) => t.id === selectedId) || null, [types, selectedId]);

  const [draftType, setDraftType] = useState(() =>
    selected
      ? {
          slug: selected.slug,
          name: selected.name,
          durationMin: selected.durationMin,
          startIntervalMin: selected.startIntervalMin,
          bufferBeforeMin: selected.bufferBeforeMin,
          bufferAfterMin: selected.bufferAfterMin,
          minNoticeHours: selected.minNoticeHours,
          rollingWeeks: selected.rollingWeeks,
          maxPerDay: selected.maxPerDay,
        }
      : {
          slug: "",
          name: "",
          durationMin: 15,
          startIntervalMin: 15,
          bufferBeforeMin: 0,
          bufferAfterMin: 0,
          minNoticeHours: 0,
          rollingWeeks: 6,
          maxPerDay: 6,
        }
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assigneeDraft, setAssigneeDraft] = useState({
    googleEmail: googleEmails[0] || "",
    displayName: "",
    timeZone: "America/New_York",
    weekdayStart: "09:00",
    weekdayEnd: "17:00",
    enabled: true,
  });

  async function saveType() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointment-types/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftType),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function createType() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointment-types`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftType),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteType() {
    if (!selected) return;
    if (!confirm(`Delete appointment type “${selected.name}”?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointment-types/${selected.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function addAssignee() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointment-types/${selected.id}/assignees`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          googleEmail: assigneeDraft.googleEmail,
          displayName: assigneeDraft.displayName || null,
          timeZone: assigneeDraft.timeZone,
          weekdayStartMin: hhmmToMinutes(assigneeDraft.weekdayStart),
          weekdayEndMin: hhmmToMinutes(assigneeDraft.weekdayEnd),
          enabled: !!assigneeDraft.enabled,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateAssignee(a: Assignee, patch: Partial<Assignee>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointment-assignees/${a.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAssignee(a: Assignee) {
    if (!confirm(`Remove ${a.googleEmail} from this appointment type?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointment-assignees/${a.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
      <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10, alignContent: "start" }}>
        <div style={{ fontWeight: 900 }}>Appointment types</div>
        <div style={{ display: "grid", gap: 8 }}>
          {types.map((t) => (
            <button
              key={t.id}
              className={`sw-navBtn ${t.id === selectedId ? "sw-navBtnActive" : ""}`}
              onClick={() => {
                setSelectedId(t.id);
                setDraftType({
                  slug: t.slug,
                  name: t.name,
                  durationMin: t.durationMin,
                  startIntervalMin: t.startIntervalMin,
                  bufferBeforeMin: t.bufferBeforeMin,
                  bufferAfterMin: t.bufferAfterMin,
                  minNoticeHours: t.minNoticeHours,
                  rollingWeeks: t.rollingWeeks,
                  maxPerDay: t.maxPerDay,
                });
              }}
            >
              <span className="sw-navIcon">C</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            </button>
          ))}
          {types.length === 0 ? <div className="sw-muted">No appointment types yet.</div> : null}
        </div>
      </div>

      <div className="sw-card sw-card-pad" style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>{selected ? "Edit appointment type" : "Create appointment type"}</div>
          {canEdit ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="sw-btn sw-btnPrimary" onClick={selected ? saveType : createType} disabled={busy}>
                {busy ? "Saving…" : selected ? "Save" : "Create"}
              </button>
              {selected ? (
                <button className="sw-btn" onClick={deleteType} disabled={busy}>
                  Delete
                </button>
              ) : null}
            </div>
          ) : (
            <div className="sw-muted" style={{ fontSize: 12 }}>
              Admin-only edit
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {error ? <div style={{ color: "var(--sw-danger)" }}>{error}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Slug
              </span>
              <input
                className="sw-input"
                value={draftType.slug}
                onChange={(e) => setDraftType((d) => ({ ...d, slug: e.target.value }))}
                disabled={!canEdit}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Name
              </span>
              <input
                className="sw-input"
                value={draftType.name}
                onChange={(e) => setDraftType((d) => ({ ...d, name: e.target.value }))}
                disabled={!canEdit}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {(
              [
                ["Duration (min)", "durationMin"],
                ["Slot interval (min)", "startIntervalMin"],
                ["Buffer before (min)", "bufferBeforeMin"],
                ["Buffer after (min)", "bufferAfterMin"],
                ["Rolling window (weeks)", "rollingWeeks"],
                ["Max per assignee/day", "maxPerDay"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} style={{ display: "grid", gap: 6 }}>
                <span className="sw-muted" style={{ fontSize: 12 }}>
                  {label}
                </span>
                <input
                  className="sw-input"
                  type="number"
                  value={(draftType as any)[key]}
                  onChange={(e) => setDraftType((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  disabled={!canEdit}
                />
              </label>
            ))}
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Minimum notice
              </span>
              <select
                className="sw-input"
                value={draftType.minNoticeHours}
                onChange={(e) => setDraftType((d) => ({ ...d, minNoticeHours: Number(e.target.value) }))}
                disabled={!canEdit}
              >
                {MIN_NOTICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selected ? (
            <div style={{ marginTop: 6, display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Assignees (Google calendars)</div>

              <div className="sw-muted" style={{ fontSize: 12 }}>
                Tip: connect Google accounts in <code>/settings/google</code> first.
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {selected.assignees.map((a) => (
                  <div key={a.id} className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{a.googleEmail}</div>
                      {canEdit ? (
                        <button className="sw-btn" onClick={() => deleteAssignee(a)} disabled={busy}>
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span className="sw-muted" style={{ fontSize: 12 }}>Display name</span>
                        <input
                          className="sw-input"
                          value={a.displayName || ""}
                          onChange={(e) => updateAssignee(a, { displayName: e.target.value || null })}
                          disabled={!canEdit || busy}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span className="sw-muted" style={{ fontSize: 12 }}>Time zone</span>
                        <input
                          className="sw-input"
                          value={a.timeZone}
                          onChange={(e) => updateAssignee(a, { timeZone: e.target.value })}
                          disabled={!canEdit || busy}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span className="sw-muted" style={{ fontSize: 12 }}>Working hours start</span>
                        <input
                          className="sw-input"
                          value={minutesToHHMM(a.weekdayStartMin)}
                          onChange={(e) => updateAssignee(a, { weekdayStartMin: hhmmToMinutes(e.target.value) })}
                          disabled={!canEdit || busy}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span className="sw-muted" style={{ fontSize: 12 }}>Working hours end</span>
                        <input
                          className="sw-input"
                          value={minutesToHHMM(a.weekdayEndMin)}
                          onChange={(e) => updateAssignee(a, { weekdayEndMin: hhmmToMinutes(e.target.value) })}
                          disabled={!canEdit || busy}
                        />
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }} className="sw-muted">
                        <input
                          type="checkbox"
                          checked={!!a.enabled}
                          onChange={(e) => updateAssignee(a, { enabled: e.target.checked })}
                          disabled={!canEdit || busy}
                        />
                        Enabled
                      </label>
                    </div>
                  </div>
                ))}

                {selected.assignees.length === 0 ? <div className="sw-muted">No assignees yet.</div> : null}
              </div>

              {canEdit ? (
                <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>Add assignee</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="sw-muted" style={{ fontSize: 12 }}>Google email</span>
                      <select
                        className="sw-input"
                        value={assigneeDraft.googleEmail}
                        onChange={(e) => setAssigneeDraft((d) => ({ ...d, googleEmail: e.target.value }))}
                        disabled={busy}
                      >
                        {googleEmails.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="sw-muted" style={{ fontSize: 12 }}>Display name (optional)</span>
                      <input
                        className="sw-input"
                        value={assigneeDraft.displayName}
                        onChange={(e) => setAssigneeDraft((d) => ({ ...d, displayName: e.target.value }))}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="sw-muted" style={{ fontSize: 12 }}>Time zone</span>
                      <input
                        className="sw-input"
                        value={assigneeDraft.timeZone}
                        onChange={(e) => setAssigneeDraft((d) => ({ ...d, timeZone: e.target.value }))}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="sw-muted" style={{ fontSize: 12 }}>Start</span>
                      <input
                        className="sw-input"
                        value={assigneeDraft.weekdayStart}
                        onChange={(e) => setAssigneeDraft((d) => ({ ...d, weekdayStart: e.target.value }))}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="sw-muted" style={{ fontSize: 12 }}>End</span>
                      <input
                        className="sw-input"
                        value={assigneeDraft.weekdayEnd}
                        onChange={(e) => setAssigneeDraft((d) => ({ ...d, weekdayEnd: e.target.value }))}
                        disabled={busy}
                      />
                    </label>
                  </div>
                  <button className="sw-btn sw-btnPrimary" onClick={addAssignee} disabled={busy || !assigneeDraft.googleEmail} style={{ justifySelf: "start" }}>
                    Add
                  </button>
                </div>
              ) : null}

              <div className="sw-muted" style={{ fontSize: 12 }}>
                Public booking URLs: <code>/book/{selected.slug}</code> and embeddable <code>/embed/discovery</code> (or
                embed <code>/book/{selected.slug}</code>).
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
