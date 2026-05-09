"use client";

import { FormEvent, useMemo, useState } from "react";

type Firm = { id: string; name: string; slug: string } | null;
type Location = { id: string; name: string; slug: string; active: boolean };
type UserRow = { id: string; email: string | null; name: string | null; locationId: string | null };

export function FirmSettingsClient({ firm, locations, users }: { firm: Firm; locations: Location[]; users: UserRow[] }) {
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationSlug, setNewLocationSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationOptions = useMemo(() => {
    return [{ id: "", label: "— Unassigned —" }, ...locations.map((l) => ({ id: l.id, label: `${l.slug} — ${l.name}` }))];
  }, [locations]);

  async function createLocation(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/firm/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newLocationName, slug: newLocationSlug }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(json.error || "Create failed");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function assignUserLocation(userId: string, locationId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/firm/user-location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, locationId: locationId || null }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(json.error || "Update failed");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Firm settings</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        {firm ? (
          <>
            Active firm: <b>{firm.name}</b> ({firm.slug})
          </>
        ) : (
          "Firm not found"
        )}
      </p>

      {error ? (
        <div style={{ marginTop: 12, color: "#ffb3c1" }}>{error}</div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <div className="sw-card sw-card-pad">
          <div style={{ fontWeight: 900 }}>Locations</div>
          <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
            v1 assumption: each user belongs to exactly one location.
          </div>

          <form onSubmit={createLocation} style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Location name
              </span>
              <input value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} placeholder="e.g., Alexandria" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Location slug
              </span>
              <input value={newLocationSlug} onChange={(e) => setNewLocationSlug(e.target.value)} placeholder="e.g., ALX" />
            </label>
            <button className="sw-btn" disabled={submitting || !newLocationName.trim() || !newLocationSlug.trim()}>
              {submitting ? "Saving…" : "Add location"}
            </button>
          </form>

          <div style={{ marginTop: 12 }}>
            {locations.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                {locations.map((l) => (
                  <li key={l.id}>
                    <b>{l.slug}</b> — {l.name} {l.active ? "" : "(inactive)"}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="sw-muted">No locations yet.</div>
            )}
          </div>
        </div>

        <div className="sw-card sw-card-pad">
          <div style={{ fontWeight: 900 }}>User locations</div>
          <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
            Assign each user to one location. This drives location reporting (P&L by location).
          </div>

          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table className="sw-table" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.name || u.email || u.id}
                    </td>
                    <td>
                      <select
                        disabled={submitting}
                        value={u.locationId || ""}
                        onChange={(e) => assignUserLocation(u.id, e.target.value)}
                      >
                        {locationOptions.map((o) => (
                          <option key={o.id || "__none"} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

