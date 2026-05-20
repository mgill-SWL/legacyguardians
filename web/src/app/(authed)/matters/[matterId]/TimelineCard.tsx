"use client";

import { FormEvent, useState } from "react";

type TimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  occurredAt: string;
  actorName: string | null;
};

const MANUAL_TYPES = [
  { value: "MANUAL_PHONE_CALL", label: "Phone call" },
  { value: "MANUAL_TEXT", label: "Text" },
  { value: "MANUAL_EMAIL", label: "Email" },
  { value: "MANUAL_MEETING", label: "Meeting" },
  { value: "MANUAL_INTERNAL_NOTE", label: "Internal note" },
  { value: "MANUAL_OTHER", label: "Other" },
] as const;

function eventLabel(type: string) {
  const manual = MANUAL_TYPES.find((t) => t.value === type);
  if (manual) return manual.label;
  return type
    .toLowerCase()
    .split("_")
    .map((s) => s.slice(0, 1).toUpperCase() + s.slice(1))
    .join(" ");
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TimelineCard({ matterId, initialEvents }: { matterId: string; initialEvents: TimelineEvent[] }) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [eventType, setEventType] = useState<(typeof MANUAL_TYPES)[number]["value"]>("MANUAL_PHONE_CALL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/timeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType, title, body: body || null, occurredAt: occurredAt || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not log activity");
      const ev = data.event;
      setEvents((prev) => [
        {
          id: ev.id,
          eventType: ev.eventType,
          title: ev.title,
          body: ev.body,
          occurredAt: ev.occurredAt,
          actorName: ev.actorUser?.name || ev.actorUser?.email || null,
        },
        ...prev,
      ]);
      setTitle("");
      setBody("");
      setOccurredAt("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not log activity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: "var(--sw-radius)",
        background: "var(--sw-card)",
        border: "1px solid var(--sw-border)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Timeline</div>

      <form onSubmit={submit} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>Activity type</span>
            <select className="sw-input" value={eventType} onChange={(e) => setEventType(e.target.value as typeof eventType)}>
              {MANUAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>When</span>
            <input className="sw-input" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>Title</span>
            <input className="sw-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Called client about signing" required />
          </label>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>Notes</span>
          <textarea className="sw-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="sw-btn" type="submit" disabled={saving}>{saving ? "Logging…" : "Log activity"}</button>
          {error ? <span style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</span> : null}
        </div>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {events.length ? events.map((ev) => (
          <div key={ev.id} style={{ border: "1px solid var(--sw-border)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div style={{ fontWeight: 900 }}>{ev.title}</div>
              <div className="sw-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmt(ev.occurredAt)}</div>
            </div>
            <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
              {eventLabel(ev.eventType)}{ev.actorName ? ` • ${ev.actorName}` : ""}
            </div>
            {ev.body ? <div style={{ whiteSpace: "pre-wrap", marginTop: 8, lineHeight: 1.45 }}>{ev.body}</div> : null}
          </div>
        )) : <div className="sw-muted">No timeline events yet.</div>}
      </div>
    </section>
  );
}
