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

export type Child = {
  name: string;
  dob?: string; // ISO date (YYYY-MM-DD)
};

export type IntakeV1 = {
  matterType: "JOINT_TRUST" | "RECIPROCAL_TRUSTS" | "WILL_ONLY" | "WILL_AND_INCAPACITY" | "INCAPACITY_ONLY";

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

  people: Person[];

  roles: {
    trustees: RoleAssignment;
    executors: RoleAssignment;
    financialAgents: RoleAssignment;
    healthAgents: RoleAssignment;
    guardians: RoleAssignment;
  };

  children: Child[];
  successorTrustees: string[];
  distributionScheme: string;
};
