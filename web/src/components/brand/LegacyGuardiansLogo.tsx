import type { CSSProperties } from "react";

type Props = {
  kind: "lockup" | "mark" | "mark_simplified";
  height?: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
};

const BASE = "/brand/legacy-guardians-brand-kit";

export function LegacyGuardiansLogo({ kind, height = 32, className, style, alt = "Legacy Guardians" }: Props) {
  const src = {
    lockup: {
      light: `${BASE}/svg/legacy-guardians-lockup-horizontal-light.svg`,
      dark: `${BASE}/svg/legacy-guardians-lockup-horizontal-dark.svg`,
    },
    mark: {
      light: `${BASE}/svg/legacy-guardians-mark-C-light.svg`,
      dark: `${BASE}/svg/legacy-guardians-mark-C-dark.svg`,
    },
    mark_simplified: {
      light: `${BASE}/svg/legacy-guardians-mark-C-simplified.svg`,
      dark: `${BASE}/svg/legacy-guardians-mark-C-simplified.svg`,
    },
  }[kind];

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", ...style }}>
      <img className="lg-theme-light-only" src={src.light} alt={alt} style={{ height, width: "auto", display: "block" }} />
      <img className="lg-theme-dark-only" src={src.dark} alt={alt} style={{ height, width: "auto", display: "none" }} />
    </span>
  );
}

