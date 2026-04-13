import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Not authorized</h1>
      <p style={{ marginTop: 8, color: "#555", maxWidth: 520 }}>
        This Legacy Guardians staff portal is limited to approved email domains.
      </p>
      <p style={{ marginTop: 16 }}>
        <Link href="/login">Back to sign in →</Link>
      </p>
    </main>
  );
}
