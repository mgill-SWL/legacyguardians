import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Legacy Guardians</h1>
      <p style={{ marginTop: 8 }}>Staff sign-in</p>

      <form
        action={async (formData) => {
          "use server";
          const email = String(formData.get("email") || "").trim();
          await signIn("resend", { email, redirectTo: "/matters" });
        }}
        style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 360 }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="name@speedwelllaw.com"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          Email me a sign-in link
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
        If you don’t receive an email, check spam/junk. Magic links expire.
      </p>
    </main>
  );
}
