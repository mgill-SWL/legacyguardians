"use client";

import { FormEvent, useMemo, useState } from "react";

type WebinarRegistrationFormProps = {
  campaignSlug: string;
  showingId?: string;
  showingStartsAt: string;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; watchToken?: string }
  | { status: "error"; message: string };

const inputStyle = {
  background: "#fff",
  border: "1px solid rgba(23, 32, 51, 0.16)",
  borderRadius: 8,
  boxSizing: "border-box",
  color: "#172033",
  font: "inherit",
  minHeight: 46,
  padding: "10px 12px",
  width: "100%",
} as const;

const labelStyle = {
  color: "#24324d",
  display: "grid",
  fontSize: 14,
  fontWeight: 700,
  gap: 6,
} as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Registration failed";
}

export function WebinarRegistrationForm({ campaignSlug, showingId, showingStartsAt }: WebinarRegistrationFormProps) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const buttonText = useMemo(() => {
    if (state.status === "submitting") return "Reserving...";
    if (state.status === "success") return "Spot Reserved";
    return "Reserve My Spot";
  }, [state.status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();

    try {
      if (!firstName || !lastName) throw new Error("Please enter your first and last name.");

      const response = await fetch("/api/webinar/register", {
        body: JSON.stringify({
          campaignSlug,
          email: form.get("email"),
          firstName,
          lastName,
          phone: form.get("phone"),
          showingId,
          showingStartsAt: showingId ? undefined : showingStartsAt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        watchToken?: string;
      };

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setState({ status: "success", watchToken: data.watchToken });
    } catch (error: unknown) {
      setState({ status: "error", message: errorMessage(error) });
    }
  }

  if (state.status === "success") {
    return (
      <section
        aria-live="polite"
        style={{
          background: "#fff",
          border: "1px solid rgba(23, 32, 51, 0.12)",
          borderRadius: 8,
          color: "#172033",
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 20, lineHeight: 1.2, margin: 0 }}>You&apos;re registered.</h2>
        <p style={{ color: "rgba(23, 32, 51, 0.68)", lineHeight: 1.5, margin: "8px 0 0" }}>
          Check your phone for the verification code and webinar access details.
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: "#fff",
        border: "1px solid rgba(23, 32, 51, 0.12)",
        borderRadius: 8,
        boxSizing: "border-box",
        color: "#172033",
        display: "grid",
        gap: 14,
        margin: "0 auto",
        maxWidth: 460,
        padding: 20,
        width: "100%",
      }}
    >
      <label style={labelStyle}>
        First Name
        <input autoComplete="given-name" name="firstName" required style={inputStyle} type="text" />
      </label>

      <label style={labelStyle}>
        Last Name
        <input autoComplete="family-name" name="lastName" required style={inputStyle} type="text" />
      </label>

      <label style={labelStyle}>
        Email Address
        <input autoComplete="email" name="email" required style={inputStyle} type="email" />
      </label>

      <label style={labelStyle}>
        Phone Number
        <input autoComplete="tel" name="phone" required style={inputStyle} type="tel" />
      </label>

      {state.status === "error" ? (
        <div role="alert" style={{ color: "#b42318", fontSize: 14, fontWeight: 700 }}>
          {state.message}
        </div>
      ) : null}

      <button
        disabled={state.status === "submitting"}
        style={{
          background: "#2E4A7F",
          border: "1px solid #2E4A7F",
          borderRadius: 8,
          color: "#fff",
          cursor: state.status === "submitting" ? "not-allowed" : "pointer",
          font: "inherit",
          fontWeight: 800,
          minHeight: 48,
          padding: "12px 16px",
          width: "100%",
        }}
        type="submit"
      >
        {buttonText}
      </button>
    </form>
  );
}
