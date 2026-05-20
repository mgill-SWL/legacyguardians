"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type UserOption = { id: string; name: string | null; email: string | null };
type MatterOption = { id: string; displayName: string };
type TaskBillingStatus = "BILLABLE" | "BILLED" | "NON_BILLABLE" | "NO_CHARGE";
type Task = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  completionPercent: number;
  billingStatus: TaskBillingStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  assigneeUser: UserOption;
  createdByUser: UserOption;
  matter: MatterOption | null;
};

const COMPLETION_STEPS = Array.from({ length: 11 }, (_, i) => i * 10);
const BILLING_STATUS_OPTIONS: Array<{ value: TaskBillingStatus; label: string }> = [
  { value: "BILLABLE", label: "Billable" },
  { value: "BILLED", label: "Billed" },
  { value: "NON_BILLABLE", label: "Non-billable" },
  { value: "NO_CHARGE", label: "No charge" },
];

function labelUser(u: UserOption | null | undefined) {
  if (!u) return "—";
  return u.name || u.email || "Unknown user";
}

function labelBillingStatus(value: TaskBillingStatus) {
  return BILLING_STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
}

function dateInputValue(iso: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

function fmtDate(iso: string | null) {
  if (!iso) return "No deadline";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(task: Task) {
  if (!task.deadline || task.completionPercent >= 100) return false;
  const due = new Date(task.deadline);
  const today = new Date();
  due.setHours(23, 59, 59, 999);
  return due.getTime() < today.getTime();
}

export function TasksClient({
  currentUserId,
  users,
  matters,
  initialTasks,
}: {
  currentUserId: string;
  users: UserOption[];
  matters: MatterOption[];
  initialTasks: Task[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [scope, setScope] = useState<"open" | "mine" | "all" | "completed">("open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigneeUserId: currentUserId,
    matterId: "",
    deadline: "",
    completionPercent: 0,
    billingStatus: "NON_BILLABLE" as TaskBillingStatus,
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (scope === "open") return t.completionPercent < 100;
      if (scope === "mine") return t.assigneeUser.id === currentUserId && t.completionPercent < 100;
      if (scope === "completed") return t.completionPercent === 100;
      return true;
    });
  }, [currentUserId, scope, tasks]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          assigneeUserId: form.assigneeUserId,
          matterId: form.matterId || null,
          deadline: form.deadline || null,
          completionPercent: form.completionPercent,
          billingStatus: form.billingStatus,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not create task");
      setTasks((prev) => [data.task, ...prev]);
      setForm({ title: "", description: "", assigneeUserId: currentUserId, matterId: "", deadline: "", completionPercent: 0, billingStatus: "NON_BILLABLE" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  }

  async function patchTask(taskId: string, body: Record<string, unknown>) {
    const previous = tasks;
    setError(null);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? ({ ...t, ...body } as Task) : t)));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not update task");
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
    } catch (err: unknown) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : "Could not update task");
    }
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not delete task");
    } catch (err: unknown) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : "Could not delete task");
    }
  }

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1">Tasks</h1>
          <div className="sw-muted" style={{ marginTop: 6 }}>
            Assign work to yourself or another firm member, optionally linked to a matter.
          </div>
        </div>
      </div>

      {error ? <div className="sw-card sw-card-pad" style={{ marginTop: 14, borderColor: "rgba(239,68,68,0.5)" }}>{error}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 14, marginTop: 14 }}>
        <form className="sw-card sw-card-pad" onSubmit={createTask} style={{ display: "grid", gap: 12, alignSelf: "start" }}>
          <div>
            <div style={{ fontWeight: 950 }}>Create task</div>
            <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
              Description is the narrative for the person creating the task.
            </div>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Task name</span>
            <input className="sw-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Narrative description</span>
            <textarea
              className="sw-input"
              rows={5}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Assignee</span>
            <select className="sw-input" value={form.assigneeUserId} onChange={(e) => setForm((f) => ({ ...f, assigneeUserId: e.target.value }))} required>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{labelUser(u)}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Deadline</span>
            <input className="sw-input" type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Matter link</span>
            <select className="sw-input" value={form.matterId} onChange={(e) => setForm((f) => ({ ...f, matterId: e.target.value }))}>
              <option value="">Independent task — no matter</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Billing category</span>
            <select className="sw-input" value={form.billingStatus} onChange={(e) => setForm((f) => ({ ...f, billingStatus: e.target.value as TaskBillingStatus }))}>
              {BILLING_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {form.billingStatus === "BILLABLE" && !form.matterId ? (
              <span className="sw-muted" style={{ fontSize: 12 }}>Billable tasks need a matter before they can be completed.</span>
            ) : null}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Completion</span>
            <select
              className="sw-input"
              value={form.completionPercent}
              onChange={(e) => setForm((f) => ({ ...f, completionPercent: Number(e.target.value) }))}
            >
              {COMPLETION_STEPS.map((v) => <option key={v} value={v}>{v}%</option>)}
            </select>
          </label>

          <button className="sw-btn sw-btnPrimary" disabled={saving} type="submit">
            {saving ? "Creating…" : "Create task"}
          </button>
        </form>

        <section className="lg:col-span-2" style={{ display: "grid", gap: 12 }}>
          <div className="sw-card sw-card-pad">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 950 }}>Task list</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["open", "mine", "completed", "all"] as const).map((s) => (
                  <button key={s} className={`sw-btn sw-btnSm ${scope === s ? "sw-btnPrimary" : "sw-btnGhost"}`} onClick={() => setScope(s)}>
                    {s === "mine" ? "My open" : s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredTasks.length ? filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} users={users} matters={matters} onPatch={patchTask} onDelete={deleteTask} />
          )) : (
            <div className="sw-card sw-card-pad sw-muted">No tasks in this view.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  users,
  matters,
  onPatch,
  onDelete,
}: {
  task: Task;
  users: UserOption[];
  matters: MatterOption[];
  onPatch: (taskId: string, body: Record<string, unknown>) => void;
  onDelete: (taskId: string) => void;
}) {
  const overdue = isOverdue(task);
  return (
    <article className="sw-card sw-card-pad" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{task.title}</div>
          <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
            Created by {labelUser(task.createdByUser)} • Assigned to {labelUser(task.assigneeUser)}
          </div>
        </div>
        <span className="sw-badge" style={overdue ? { borderColor: "rgba(239,68,68,0.55)", color: "#ef4444" } : undefined}>
          {overdue ? "Overdue: " : "Due: "}{fmtDate(task.deadline)}
        </span>
      </div>

      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{task.description}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {task.matter ? <Link className="sw-badge" href={`/matters/${task.matter.id}`}>Matter: {task.matter.displayName}</Link> : <span className="sw-badge">No matter</span>}
        <span className="sw-badge">{labelBillingStatus(task.billingStatus)}</span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Completion</div>
          <select
            className="sw-input"
            style={{ width: 110, padding: "8px 10px" }}
            value={task.completionPercent}
            onChange={(e) => onPatch(task.id, { completionPercent: Number(e.target.value) })}
          >
            {COMPLETION_STEPS.map((v) => <option key={v} value={v}>{v}%</option>)}
          </select>
        </div>
        <ProgressBar value={task.completionPercent} />
        {task.billingStatus === "BILLABLE" && !task.matter && task.completionPercent < 100 ? (
          <div className="sw-muted" style={{ fontSize: 12 }}>Link this billable task to a matter before marking it complete.</div>
        ) : null}
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Edit details</summary>
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 10, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12, fontWeight: 900 }}>Assignee</span>
            <select className="sw-input" value={task.assigneeUser.id} onChange={(e) => onPatch(task.id, { assigneeUserId: e.target.value })}>
              {users.map((u) => <option key={u.id} value={u.id}>{labelUser(u)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12, fontWeight: 900 }}>Deadline</span>
            <input className="sw-input" type="date" defaultValue={dateInputValue(task.deadline)} onBlur={(e) => onPatch(task.id, { deadline: e.target.value || null })} />
          </label>
          <label className="lg:col-span-2" style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12, fontWeight: 900 }}>Matter</span>
            <select className="sw-input" value={task.matter?.id || ""} onChange={(e) => onPatch(task.id, { matterId: e.target.value || null })}>
              <option value="">Independent task — no matter</option>
              {matters.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
          </label>
          <label className="lg:col-span-2" style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12, fontWeight: 900 }}>Billing category</span>
            <select className="sw-input" value={task.billingStatus} onChange={(e) => onPatch(task.id, { billingStatus: e.target.value })}>
              {BILLING_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="sw-btn sw-btnGhost" onClick={() => onDelete(task.id)}>Delete task</button>
        </div>
      </details>
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ height: 14, borderRadius: 999, border: "1px solid var(--sw-border)", overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: "100%",
          background: "linear-gradient(135deg, rgba(110,231,255,0.75), rgba(167,139,250,0.65))",
        }}
      />
    </div>
  );
}
