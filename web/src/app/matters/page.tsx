import Link from "next/link";

import { auth, signOut } from "@/auth";

export default async function MattersPage() {
  const session = await auth();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Matters</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit">Sign out</button>
        </form>
      </header>

      <p style={{ marginTop: 8, color: "#666" }}>
        Signed in as {session?.user?.email}
      </p>

      <div style={{ marginTop: 16 }}>
        <Link href="/matters/new">Create new matter →</Link>
      </div>

      <p style={{ marginTop: 24 }}>
        (Next up: list matters from Postgres. Right now this is just a skeleton.)
      </p>
    </main>
  );
}
