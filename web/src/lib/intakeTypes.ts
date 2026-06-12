export type Person = {
  id: string;
  name: string;
  /**
   * Legacy single-string relationship label (e.g., "brother", "friend").
   * Prefer the relationshipPhrase* fields for document rendering.
   */
  relationship?: string;

  /**
   * Relationship phrases used for drafting.
   * These should already include the right determiner/possessive, e.g.:
   *  - "my brother" (spouse1 POV)
   *  - "my brother-in-law" (spouse2 POV)
   *  - "John's brother" or "our friend" (joint POV)
   */
  relationshipPhraseToSpouse1?: string;
  relationshipPhraseToSpouse2?: string;
  relationshipPhraseJoint?: string;

  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  email?: string;
  phone?: string;
};

export type RoleAssignment = {
  primary?: string; // personId
  alternate1?: string;
  alternate2?: string;
};

/**
 * Newer intake schema: each client can have their own independent role assignments.
 *
 * Back-compat: older intakes stored a single RoleAssignment (applied to both clients).
 */
export type RoleAssignmentByClient = {
  client1: RoleAssignment;
  client2: RoleAssignment;
};

export type RoleAssignmentMaybeByClient = RoleAssignment | RoleAssignmentByClient;

/** Final disposition agents allow co-agents at each successor level.
 *
 * Shape is an array of ranks (0=primary representative), where each rank is an array
 * of personIds (co-agents).
 */
export type CoAgentRanks = string[][]; // personIds by rank
export type CoAgentRanksByClient = {
  client1: CoAgentRanks;
  client2: CoAgentRanks;
};
export type CoAgentRanksMaybeByClient = CoAgentRanks | CoAgentRanksByClient;

export type ActingMode = "EITHER" | "JOINT";
export type RankGroup = { actingMode: ActingMode; personIds: string[] };
export type RankedRoles = {
  trustees: RankGroup[];
  executors: RankGroup[];
  financialAgents: RankGroup[];
  healthAgents: RankGroup[];
  /** Legacy v1 (ranked) does not currently drive Final Disposition agent selection. */
  guardians: RankGroup[];
};

export type Child = {
  name: string;
  dob?: string; // ISO date (YYYY-MM-DD)
};

export type Offering =
  | "JOINT_TRUST"
  | "INDIVIDUAL_TRUST"
  | "RECIPROCAL_TRUSTS"
  | "WILL_ONLY"
  | "WILL_AND_INCAPACITY"
  | "INCAPACITY_ONLY";

export type IntakeV1 = {
  /** Product/offering selected for this matter. */
  offering: Offering;

  /** @deprecated legacy name; keep for back-compat when loading older saved intakes */
  matterType?: Offering;

  grantors: [string, string];
  hasMinorChildren: boolean;

  clientAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };

  clientEmails: {
    client1?: string;
    client2?: string;
  };

  clientPhones: {
    client1?: string;
    client2?: string;
  };

  trustNameOverride?: string;

  /**
   * Reciprocal trusts: optional per-client trust-name overrides (for each individual's trust).
   * This is distinct from Matter.displayName (matter label) and from trustNameOverride
   * (single override for joint/individual trust offerings).
   */
  trustNameOverridesByClient?: {
    client1?: string;
    client2?: string;
  };

  /**
   * Reciprocal trusts: if a client's trust is a restatement of an existing trust,
   * the original trust date (YYYY-MM-DD). When set, the spouse's residue clause
   * cross-references the trust "under date of trust <date>" instead of
   * "concurrently herewith".
   */
  trustOriginalDatesByClient?: {
    client1?: string;
    client2?: string;
  };

  people: Person[];

  roles: {
    trustees: RoleAssignmentMaybeByClient;
    executors: RoleAssignmentMaybeByClient;
    financialAgents: RoleAssignmentMaybeByClient;
    healthAgents: RoleAssignmentMaybeByClient;
    /** Appointment of agent to control disposition of remains (ranked, co-agents allowed per rank). */
    finalDispositionAgents?: CoAgentRanksMaybeByClient;
    guardians: RoleAssignment;
  };

  /** New v1 schema: ranked fiduciary groups per role (autosave). */
  rankedRoles?: RankedRoles;

  children: Child[];
  successorTrustees: string[];
  distributionScheme: string;

  /** Optional: trust protector (v1 EPIS). */
  trustProtector?: {
    enabled?: boolean;
    name?: string;
  };
};
