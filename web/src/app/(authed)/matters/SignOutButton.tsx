"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc" }}
    >
      Sign out
    </button>
  );
}
