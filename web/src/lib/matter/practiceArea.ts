import type { MatterPartyRole, PracticeArea } from "@prisma/client";

export const PRACTICE_AREAS: { value: PracticeArea; label: string }[] = [
  { value: "ESTATE_PLANNING", label: "Estate Planning" },
  { value: "ESTATE_ADMINISTRATION", label: "Estate Administration" },
  { value: "TRUST_ADMINISTRATION", label: "Trust Administration" },
  { value: "ELDER_LAW", label: "Elder Law" },
  { value: "FIDUCIARY_SERVICES", label: "Fiduciary Services" },
  { value: "LITIGATION", label: "Litigation" },
];

export const PRACTICE_AREA_LABEL: Record<PracticeArea, string> = {
  ESTATE_PLANNING: "Estate Planning",
  ESTATE_ADMINISTRATION: "Estate Administration",
  TRUST_ADMINISTRATION: "Trust Administration",
  ELDER_LAW: "Elder Law",
  FIDUCIARY_SERVICES: "Fiduciary Services",
  LITIGATION: "Litigation",
};

/** Subject-area options for a litigation matter (everything except Litigation itself). */
export const LITIGATION_SUBJECT_AREAS = PRACTICE_AREAS.filter((a) => a.value !== "LITIGATION");

export const MATTER_PARTY_ROLES: { value: MatterPartyRole; label: string }[] = [
  { value: "CLIENT", label: "Client" },
  { value: "CO_CLIENT", label: "Co-client" },
  { value: "OPPOSING_PARTY", label: "Opposing party" },
  { value: "OPPOSING_COUNSEL", label: "Opposing counsel" },
  { value: "WITNESS", label: "Witness" },
  { value: "OTHER", label: "Other" },
];

export const MATTER_PARTY_ROLE_LABEL: Record<MatterPartyRole, string> = {
  CLIENT: "Client",
  CO_CLIENT: "Co-client",
  OPPOSING_PARTY: "Opposing party",
  OPPOSING_COUNSEL: "Opposing counsel",
  WITNESS: "Witness",
  OTHER: "Other",
};

export const PRACTICE_AREA_VALUES = new Set<string>(PRACTICE_AREAS.map((a) => a.value));
export const MATTER_PARTY_ROLE_VALUES = new Set<string>(MATTER_PARTY_ROLES.map((r) => r.value));
