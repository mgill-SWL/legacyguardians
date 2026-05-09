export type Offering =
  | "JOINT_TRUST"
  | "RECIPROCAL_TRUSTS"
  | "WILL_ONLY"
  | "WILL_AND_INCAPACITY"
  | "INCAPACITY_ONLY";

export const offeringLabels: Record<Offering, string> = {
  JOINT_TRUST: "Joint trust (packet)",
  RECIPROCAL_TRUSTS: "Reciprocal individual trusts (packet)",
  WILL_ONLY: "Wills only",
  WILL_AND_INCAPACITY: "Wills + incapacity docs",
  INCAPACITY_ONLY: "Incapacity docs only",
};
