"use client";

import { useEffect, useMemo, useState } from "react";

type Slot = { start: string; available: number; assignees: string[] };

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingClient({ embedded, typeSlug }: { embedded?: boolean; typeSlug?: string }) {
  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState<string>(toDateInputValue(today));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string>("");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const [status, setStatus] = useState<string>("");
  const [done, setDone] = useState<{ appointmentId: string; assignedTo: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStatus("");
      setSelectedStart("");
      try {
        const slug = typeSlug || "discovery-call";
        const res = await fetch(
          `/api/booking/slots?type=${encodeURIComponent(slug)}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!cancelled) setSlots(Array.isArray(json.slots) ? json.slots : []);
      } catch (e: any) {
        if (!cancelled) {
          setSlots([]);
          setStatus(e?.message || "Failed to load slots");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  async function submit() {
    setStatus("");
    if (!selectedStart) return setStatus("Pick a time first.");
    if (!clientName.trim()) return setStatus("Name is required.");
    if (!clientEmail.trim() && !clientPhone.trim()) return setStatus("Email or phone is required.");

    try {
      setLoading(true);
      const slug = typeSlug || "discovery-call";
      const res = await fetch(`/api/booking/public-book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: slug,
          startsAtIso: selectedStart,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || undefined,
          clientPhone: clientPhone.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setDone({ appointmentId: json.appointmentId, assignedTo: json.assignedTo });
    } catch (e: any) {
      setStatus(e?.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  const wrapStyle: React.CSSProperties = embedded
    ? { maxWidth: 760, margin: "0 auto", padding: "16px 14px" }
    : { maxWidth: 900, margin: "0 auto", padding: "44px 18px 64px" };

  return (
    <main style={wrapStyle}>
      {embedded ? null : <h1 style={{ margin: 0, fontSize: 28 }}>Book a discovery call</h1>}
      {embedded ? null : (
        <p style={{ marginTop: 10, color: "var(--sw-muted)", maxWidth: 720 }}>
          Pick a time and we’ll put it directly on an intake specialist’s Google Calendar.
        </p>
      )}

      {done ? (
        <div className="sw-card sw-card-pad" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900 }}>Booked</div>
          <div style={{ marginTop: 8 }}>
            Appointment ID: <code>{done.appointmentId}</code>
          </div>
          <div style={{ marginTop: 6 }} className="sw-muted">
            Assigned to: {done.assignedTo}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>1) Choose a date</div>
            <input
              className="sw-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            {status ? <div style={{ color: "var(--sw-danger)" }}>{status}</div> : null}
          </div>

          <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>2) Choose a time</div>
            {loading ? <div className="sw-muted">Loading…</div> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {slots.map((s) => {
                const label = new Date(s.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                const active = selectedStart === s.start;
                return (
                  <button
                    key={s.start}
                    type="button"
                    className={"sw-btn"}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid var(--sw-border)",
                      background: active ? "var(--sw-primary)" : "var(--sw-surface)",
                      color: active ? "white" : "inherit",
                    }}
                    onClick={() => setSelectedStart(s.start)}
                  >
                    {label}
                  </button>
                );
              })}
              {slots.length === 0 && !loading ? <div className="sw-muted">No availability on this date.</div> : null}
            </div>
          </div>

          <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>3) Your info</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              <input className="sw-input" placeholder="Full name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <input className="sw-input" placeholder="Email (optional)" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              <input className="sw-input" placeholder="Phone (optional)" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </div>
            <button className="sw-btn sw-btnPrimary" type="button" onClick={submit} disabled={loading} style={{ justifySelf: "start" }}>
              {loading ? "Booking…" : "Book"}
            </button>
            <div className="sw-muted" style={{ fontSize: 12 }}>
              By booking, you consent to receive scheduling texts/emails.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
