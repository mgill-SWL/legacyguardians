"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type QueueTask = {
  id: string;
  contactName: string;
  phone: string;
  type: string;
  campaignSlug: string;
  ownerTeam: string;
  showingLabel: string | null;
  priority: string;
  status: string;
  disposition: string | null;
  dueAtISO: string;
  lastTouchLabel: string | null;
  notes: string | null;
};

const STATUS_OPTS: [string, string][] = [
  ["OPEN", "Open"],
  ["IN_PROGRESS", "In progress"],
  ["DONE", "Done"],
];
const PRIORITY_OPTS: [string, string][] = [
  ["HOT", "Hot"],
  ["WARM", "Warm"],
  ["COLD", "Cold"],
];
const DISPOSITION_OPTS: [string, string][] = [
  ["", "— No disposition —"],
  ["SCHEDULED_DISCOVERY", "Scheduled discovery"],
  ["INTERESTED_FOLLOW_UP", "Interested — follow up"],
  ["NOT_INTERESTED", "Not interested"],
  ["NO_ANSWER_RETRY", "No answer — retry"],
  ["LEFT_VOICEMAIL", "Left voicemail"],
  ["WRONG_NUMBER", "Wrong number"],
  ["DISQUALIFIED_JURISDICTION", "Disqualified — jurisdiction"],
  ["REFERRED_TO_OVERTURE", "Referred to Overture"],
  ["BOOKING_LINK_SENT", "Booking link sent"],
];

function taskLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function QueueRow({ task }: { task: QueueTask }) {
  const router = useRouter();
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [disposition, setDisposition] = useState(task.disposition ?? "");
  const [dueLocal, setDueLocal] = useState(toLocalInput(task.dueAtISO));
  const [notes, setNotes] = useState(task.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/crm/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setSaved(true);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    patch({
      status,
      priority,
      disposition: disposition || null,
      dueAt: dueLocal ? new Date(dueLocal).toISOString() : undefined,
      notes,
    });
  }

  const priorityColor = priority === "HOT" ? "#e11d48" : priority === "WARM" ? "#d97706" : "var(--sw-muted)";

  return (
    <div style={{ border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius)", padding: 14, background: "var(--sw-card)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 800 }}>{task.contactName}</div>
          <div style={{ color: "var(--sw-muted)", fontSize: 12 }}>{task.phone}</div>
        </div>
        <div style={{ color: "var(--sw-muted)", fontSize: 12, textAlign: "right" }}>
          <span style={{ color: priorityColor, fontWeight: 800 }}>{taskLabel(priority)}</span> · {taskLabel(task.type)} · {task.ownerTeam}
          {task.campaignSlug ? ` · ${task.campaignSlug}` : ""}
          {task.showingLabel ? ` · showing ${task.showingLabel}` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sw-muted)" }}>Status</span>
          <select className="sw-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sw-muted)" }}>Priority</span>
          <select className="sw-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sw-muted)" }}>Disposition</span>
          <select className="sw-input" value={disposition} onChange={(e) => setDisposition(e.target.value)}>
            {DISPOSITION_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sw-muted)" }}>Due</span>
          <input className="sw-input" type="datetime-local" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} />
        </label>
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sw-muted)" }}>Note</span>
        <input className="sw-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call outcome, next step, etc." />
      </label>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="sw-btn sw-btnPrimary sw-btnSm" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="sw-btn sw-btnSm" disabled={busy || status === "DONE"} onClick={() => patch({ status: "DONE" })}>
          Mark done
        </button>
        {saved ? <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>Saved</span> : null}
        {error ? <span style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</span> : null}
        {task.lastTouchLabel ? <span style={{ marginLeft: "auto", color: "var(--sw-muted)", fontSize: 12 }}>Last touch: {task.lastTouchLabel}</span> : null}
      </div>
    </div>
  );
}

export function QueueList({ tasks }: { tasks: QueueTask[] }) {
  if (tasks.length === 0) {
    return <div style={{ color: "var(--sw-muted)", padding: "8px 0" }}>Nothing is due right now.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {tasks.map((t) => <QueueRow key={t.id} task={t} />)}
    </div>
  );
}
