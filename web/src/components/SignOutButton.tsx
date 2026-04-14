"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--sw-border, #ccc)",
        background: "rgba(255,255,255,0.04)",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
