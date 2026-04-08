export type Person = {
  id: string;
  name: string;
  relationship?: string;
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
