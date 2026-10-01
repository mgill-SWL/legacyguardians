import type { IntakeV1 } from "../src/lib/intakeTypes";

/**
 * Shared sample intake used by the template audit tools. Kept in one place so
 * the single-template audit and the reciprocal-branch coverage render the same
 * realistic data.
 */
export function sampleIntake(): IntakeV1 {
  return {
    offering: "JOINT_TRUST",
    matterType: "JOINT_TRUST",
    grantors: ["Alexandra M. Doe", "Benjamin R. Doe"],
    hasMinorChildren: true,
    clientAddress: {
      street: "123 Main St",
      city: "Fairfax",
      state: "VA",
      zip: "22030",
    },
    clientEmails: { client1: "alex@example.com", client2: "ben@example.com" },
    clientPhones: { client1: "+17035550100", client2: "+17035550101" },
    trustNameOverride: "The Doe Family Trust",
    people: [
      {
        id: "sp1",
        name: "Alexandra M. Doe",
        email: "alex@example.com",
        phone: "+17035550100",
      },
      {
        id: "sp2",
        name: "Benjamin R. Doe",
        email: "ben@example.com",
        phone: "+17035550101",
      },
      {
        id: "p_guard1",
        name: "Jordan Smith",
        relationship: "sister",
        relationshipPhraseToSpouse1: "my sister",
        relationshipPhraseToSpouse2: "my sister-in-law",
        relationshipPhraseJoint: "our sister",
        addressStreet: "1 Oak Ave",
        addressCity: "Arlington",
        addressState: "VA",
        addressZip: "22201",
        email: "jordan@example.com",
        phone: "+17035550111",
      },
      {
        id: "p_guard2",
        name: "Casey Lee",
        relationship: "friend",
        relationshipPhraseToSpouse1: "my friend",
        relationshipPhraseToSpouse2: "my friend",
        relationshipPhraseJoint: "our friend",
        addressStreet: "2 Pine Rd",
        addressCity: "Alexandria",
        addressState: "VA",
        addressZip: "22314",
        email: "casey@example.com",
        phone: "+17035550112",
      },
      {
        id: "p_trustee",
        name: "Taylor Nguyen",
        relationship: "brother",
        relationshipPhraseToSpouse1: "my brother",
        relationshipPhraseToSpouse2: "my brother-in-law",
        relationshipPhraseJoint: "our brother",
        addressStreet: "3 Cedar St",
        addressCity: "Richmond",
        addressState: "VA",
        addressZip: "23220",
        email: "taylor@example.com",
        phone: "+17035550113",
      },
    ],
    roles: {
      trustees: { primary: "sp1", alternate1: "p_trustee", alternate2: "p_guard2" },
      executors: { primary: "sp1", alternate1: "p_trustee", alternate2: "p_guard2" },
      financialAgents: { primary: "sp1", alternate1: "p_trustee", alternate2: "p_guard2" },
      healthAgents: { primary: "sp1", alternate1: "p_guard1", alternate2: "p_guard2" },
      guardians: { primary: "p_guard1", alternate1: "p_guard2", alternate2: "p_trustee" },
    },
    children: [
      { name: "Charlie Doe", dob: "2017-06-15" },
      { name: "Dakota Doe", dob: "2019-09-02" },
    ],
    successorTrustees: ["Taylor Nguyen"],
    distributionScheme: "standard-per-stirpes-ni21-row-25-30-halves",
    trustProtector: { enabled: true, name: "Morgan Riley" },
  };
}
