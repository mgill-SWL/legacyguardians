"use client";

import { useEffect, useMemo, useState } from "react";

type Slot = { start: string; available: number; assignees: string[] };
type SlotsResponse = { ok?: boolean; error?: string; tz?: string; slots?: Slot[] };
type BookingResponse = { ok?: boolean; error?: string; appointmentId?: string; assignedTo?: string; matterId?: string };
type Errors = Partial<Record<keyof ContactForm | "selectedStart", string>>;

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  needHelpWith: string;
  heardAboutUs: string;
  smsConsent: boolean;
  additionalAttendees: string;
};

const NEED_HELP_OPTIONS = [
  "Business - Business General",
  "Deed Only Representation",
  "Elder Law/Guardianship",
  "Estate Planning",
  "Probate Estate Administration (after death)",
  "Trust Administration (after death)",
];

const HEARD_ABOUT_OPTIONS = [
  "Facebook",
  "Google LSAs",
  "Google PPC",
  "Referrals",
  "Thompson Reuters/Super Lawyers/FindLaw",
  "Webinar",
];

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000);
}

function formatTimeRange(iso: string) {
  const start = new Date(iso);
  const end = addMinutes(iso, 15);
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  const startText = start.toLocaleTimeString([], opts).replace(" ", "").toLowerCase();
  const endText = end.toLocaleTimeString([], opts).replace(" ", "").toLowerCase();
  return `${startText} - ${endText}`;
}

function formatDateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function emptyForm(): ContactForm {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    needHelpWith: "",
    heardAboutUs: "",
    smsConsent: false,
    additionalAttendees: "",
  };
}

export function BookingClient({ embedded, typeSlug }: { embedded?: boolean; typeSlug?: string }) {
  const today = useMemo(() => new Date(), []);
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState<string>(toDateInputValue(today));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tz, setTz] = useState("America/New_York");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string>("");
  const [form, setForm] = useState<ContactForm>(() => emptyForm());
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<string>("");
  const [done, setDone] = useState<{ appointmentId: string; assignedTo: string; matterId?: string } | null>(null);

  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      setStatus("");
      setSelectedStart("");
      try {
        const slug = typeSlug || "discovery-call";
        const res = await fetch(
          `/api/booking/slots?type=${encodeURIComponent(slug)}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => null)) as SlotsResponse | null;
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!cancelled) {
          setSlots(Array.isArray(json.slots) ? json.slots : []);
          if (json.tz) setTz(String(json.tz));
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setSlots([]);
          setStatus(errorMessage(e, "Failed to load slots"));
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, step, typeSlug]);

  function update<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateContact() {
    const next: Errors = {};
    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!isValidEmail(form.email)) next.email = "Enter a valid email address.";
    if (!form.phone.trim()) next.phone = "Phone is required.";
    else if (!isValidPhone(form.phone)) next.phone = "Enter a valid phone number.";
    if (!form.needHelpWith) next.needHelpWith = "Please choose an option.";
    if (!form.heardAboutUs) next.heardAboutUs = "Please choose an option.";
    if (!form.smsConsent) next.smsConsent = "SMS consent is required to book online.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goToSchedule() {
    setStatus("");
    if (validateContact()) setStep(2);
  }

  async function submit() {
    setStatus("");
    const contactOk = validateContact();
    if (!selectedStart) {
      setErrors((prev) => ({ ...prev, selectedStart: "Pick a time first." }));
      return;
    }
    if (!contactOk) {
      setStep(1);
      return;
    }

    try {
      setBooking(true);
      const slug = typeSlug || "discovery-call";
      const res = await fetch(`/api/booking/public-book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: slug,
          startsAtIso: selectedStart,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          clientName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          clientEmail: form.email.trim(),
          clientPhone: form.phone.trim(),
          needHelpWith: form.needHelpWith,
          heardAboutUs: form.heardAboutUs,
          smsConsent: form.smsConsent,
          smsConsentText: SMS_CONSENT_TEXT,
          additionalAttendeeEmails: form.additionalAttendees
            .split(/[;,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          location: "Phone",
          timeZone: tz,
        }),
      });
      const json = (await res.json().catch(() => null)) as BookingResponse | null;
      if (!res.ok || !json?.ok || !json.appointmentId || !json.assignedTo) throw new Error(json?.error || `HTTP ${res.status}`);
      setDone({ appointmentId: json.appointmentId, assignedTo: json.assignedTo, matterId: json.matterId });
    } catch (e: unknown) {
      setStatus(errorMessage(e, "Booking failed"));
    } finally {
      setBooking(false);
    }
  }

  const shellStyle: React.CSSProperties = embedded
    ? { minHeight: "100vh", background: "#3F64AE", padding: "24px 14px", boxSizing: "border-box" }
    : { minHeight: "100vh", background: "#3F64AE", padding: "44px 18px 64px", boxSizing: "border-box" };

  return (
    <main style={shellStyle}>
      <section
        style={{
          maxWidth: 940,
          margin: "0 auto",
          borderRadius: 18,
          background: "#fff",
          color: "#16213f",
          boxShadow: "0 24px 70px rgba(17, 34, 68, 0.22)",
          overflow: "hidden",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ padding: "28px 30px 22px", borderBottom: "1px solid #e8edf7" }}>
          <h1 style={{ margin: 0, textAlign: "center", fontSize: 24, lineHeight: 1.25, color: "#22355f" }}>
            Fill out this form to book a call with our team.
          </h1>
          <p style={{ margin: "12px auto 0", maxWidth: 780, textAlign: "center", fontSize: 12, lineHeight: 1.45, color: "#5a6782" }}>
            No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All other categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
          </p>
          <Progress step={step} />
        </div>

        {done ? (
          <div style={{ padding: 30, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1f7a4d" }}>Your Discovery Call is booked.</div>
            <p style={{ margin: 0, color: "#44516d" }}>
              We’ve saved your information and scheduled the call. A confirmation will be sent to the email/phone provided.
            </p>
            <div style={{ border: "1px solid #e1e7f2", borderRadius: 12, padding: 14, background: "#f8faff", display: "grid", gap: 6 }}>
              <div>Appointment ID: <code>{done.appointmentId}</code></div>
              <div>Assigned to: {done.assignedTo}</div>
              {done.matterId ? <div>Internal matter ID: <code>{done.matterId}</code></div> : null}
            </div>
          </div>
        ) : step === 1 ? (
          <ContactStep form={form} errors={errors} update={update} onNext={goToSchedule} />
        ) : (
          <ScheduleStep
            date={date}
            setDate={setDate}
            slots={slots}
            tz={tz}
            loading={loadingSlots}
            selectedStart={selectedStart}
            setSelectedStart={(value) => {
              setSelectedStart(value);
              setErrors((prev) => ({ ...prev, selectedStart: undefined }));
            }}
            additionalAttendees={form.additionalAttendees}
            setAdditionalAttendees={(value) => update("additionalAttendees", value)}
            status={status}
            error={errors.selectedStart}
            onBack={() => setStep(1)}
            onSubmit={submit}
            booking={booking}
          />
        )}
      </section>
    </main>
  );
}

function Progress({ step }: { step: 1 | 2 }) {
  return (
    <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[
        [1, "Contact Information"],
        [2, "Choose a Date"],
      ].map(([num, label]) => {
        const active = step === num;
        const complete = step > Number(num);
        return (
          <div key={String(num)} style={{ display: "flex", alignItems: "center", gap: 10, color: active || complete ? "#2E4A7F" : "#7a8499", fontWeight: 800 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                display: "inline-grid",
                placeItems: "center",
                background: active || complete ? "#2E4A7F" : "#edf1f8",
                color: active || complete ? "white" : "#7a8499",
                fontSize: 13,
              }}
            >
              {complete ? "✓" : num}
            </span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

const SMS_CONSENT_TEXT =
  "I consent to receive non-marketing text messages from Speedwell Law PLLC related to my inquiry and follow-up communications, including requests for feedback/reviews. Frequency may vary. Message & data rates may apply. Reply stop to +1 423-540-4290 for opt-out. Text HELP for assistance.";

function ContactStep({
  form,
  errors,
  update,
  onNext,
}: {
  form: ContactForm;
  errors: Errors;
  update: <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => void;
  onNext: () => void;
}) {
  return (
    <div style={{ padding: 30 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <Field label="First Name" error={errors.firstName}>
          <input style={inputStyle(errors.firstName)} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Last Name" error={errors.lastName}>
          <input style={inputStyle(errors.lastName)} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} autoComplete="family-name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input style={inputStyle(errors.email)} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input style={inputStyle(errors.phone)} type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" />
        </Field>
        <Field label="What Do You Need Help With?" error={errors.needHelpWith}>
          <select style={inputStyle(errors.needHelpWith)} value={form.needHelpWith} onChange={(e) => update("needHelpWith", e.target.value)}>
            <option value="">Please select...</option>
            {NEED_HELP_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </Field>
        <Field label="How did you hear about us?" error={errors.heardAboutUs}>
          <select style={inputStyle(errors.heardAboutUs)} value={form.heardAboutUs} onChange={(e) => update("heardAboutUs", e.target.value)}>
            <option value="">Please select...</option>
            {HEARD_ABOUT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </Field>
      </div>

      <label style={{ marginTop: 18, display: "grid", gridTemplateColumns: "20px 1fr", gap: 10, alignItems: "start", color: "#33415f", fontSize: 13, lineHeight: 1.45 }}>
        <input type="checkbox" checked={form.smsConsent} onChange={(e) => update("smsConsent", e.target.checked)} style={{ marginTop: 2 }} />
        <span>{SMS_CONSENT_TEXT}</span>
      </label>
      {errors.smsConsent ? <div style={{ marginTop: 6, color: "#b42318", fontSize: 12 }}>{errors.smsConsent}</div> : null}

      <div style={{ minHeight: 72, marginTop: 16, border: "1px solid #e1e7f2", borderRadius: 10, display: "grid", placeItems: "center", color: "#6b7590", background: "#f8faff", fontSize: 13 }}>
        reCAPTCHA / bot protection placeholder
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#3F64AE" }}>
          <a href="/privacy" target="_blank">Privacy Policy</a>
          <a href="/terms" target="_blank">Terms of Service</a>
        </div>
        <button type="button" onClick={onNext} style={primaryButtonStyle}>Next</button>
      </div>
    </div>
  );
}

function ScheduleStep({
  date,
  setDate,
  slots,
  tz,
  loading,
  selectedStart,
  setSelectedStart,
  additionalAttendees,
  setAdditionalAttendees,
  status,
  error,
  onBack,
  onSubmit,
  booking,
}: {
  date: string;
  setDate: (date: string) => void;
  slots: Slot[];
  tz: string;
  loading: boolean;
  selectedStart: string;
  setSelectedStart: (start: string) => void;
  additionalAttendees: string;
  setAdditionalAttendees: (value: string) => void;
  status: string;
  error?: string;
  onBack: () => void;
  onSubmit: () => void;
  booking: boolean;
}) {
  return (
    <div style={{ padding: 30 }}>
      <h2 style={{ margin: 0, color: "#22355f", fontSize: 22 }}>Choose a time for your Discovery Call</h2>
      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "minmax(240px, 0.85fr) minmax(280px, 1.15fr)", gap: 22 }}>
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <Field label="Date">
            <input style={inputStyle()} type="date" value={date} min={toDateInputValue(new Date())} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div style={{ border: "1px solid #e1e7f2", borderRadius: 12, padding: 14, background: "#f8faff" }}>
            <div style={{ fontWeight: 800, color: "#2E4A7F" }}>{formatDateLabel(date)}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#66728a" }}>Available dates/times are generated from the intake team’s round-robin calendar availability.</div>
          </div>
          <Field label="Timezone">
            <select style={inputStyle()} value={tz} disabled>
              <option>{tz === "America/New_York" ? "(-05:00) - Eastern Time (US & Canada)" : tz}</option>
            </select>
          </Field>
          <Field label="Location">
            <input style={inputStyle()} value="Phone" disabled />
          </Field>
          <Field label="Additional attendee emails (optional)">
            <textarea
              style={{ ...inputStyle(), minHeight: 78, resize: "vertical" }}
              placeholder="name@example.com"
              value={additionalAttendees}
              onChange={(e) => setAdditionalAttendees(e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <div style={{ fontWeight: 800, color: "#22355f" }}>Available times</div>
          {loading ? <div style={{ color: "#66728a" }}>Loading availability…</div> : null}
          {status ? <div style={{ color: "#b42318" }}>{status}</div> : null}
          {error ? <div style={{ color: "#b42318", fontSize: 12 }}>{error}</div> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {slots.map((s) => {
              const active = selectedStart === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => setSelectedStart(s.start)}
                  style={{
                    padding: "11px 12px",
                    borderRadius: 10,
                    border: active ? "1px solid #2E4A7F" : "1px solid #dbe3f0",
                    background: active ? "#2E4A7F" : "#fff",
                    color: active ? "#fff" : "#22355f",
                    fontWeight: 800,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {formatTimeRange(s.start)}
                </button>
              );
            })}
          </div>
          {slots.length === 0 && !loading ? <div style={{ color: "#66728a" }}>No availability on this date.</div> : null}
        </div>
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button type="button" onClick={onBack} style={secondaryButtonStyle}>Back</button>
        <button type="button" onClick={onSubmit} disabled={booking || loading} style={{ ...primaryButtonStyle, opacity: booking || loading ? 0.65 : 1 }}>
          {booking ? "Booking…" : "Book Discovery Call"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#2d3954", fontWeight: 700 }}>
      <span>{label}</span>
      {children}
      {error ? <span style={{ color: "#b42318", fontSize: 12, fontWeight: 600 }}>{error}</span> : null}
    </label>
  );
}

function inputStyle(error?: string): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 9,
    border: `1px solid ${error ? "#d92d20" : "#ccd6e6"}`,
    background: "#fff",
    color: "#17213a",
    padding: "11px 12px",
    fontSize: 14,
    outline: "none",
  };
}

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  background: "#2E4A7F",
  color: "#fff",
  padding: "11px 18px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #ccd6e6",
  borderRadius: 10,
  background: "#fff",
  color: "#2E4A7F",
  padding: "11px 18px",
  fontWeight: 900,
  cursor: "pointer",
};
