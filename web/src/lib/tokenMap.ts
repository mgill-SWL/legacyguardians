import type { IntakeV1, Person } from "./intakeTypes";
import { defaultTrustNameFromClient1 } from "./names";

function byId(people: Person[], id?: string) {
  if (!id) return undefined;
  return people.find((p) => p.id === id);
}

function formatAddress(p?: Person) {
  if (!p) return "";
  // Back-compat: older saved intakes used street/city/state/zip keys.
  const anyP = p as Person & {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  const parts = [
    p.addressStreet ?? anyP.street,
    p.addressCity ?? anyP.city,
    p.addressState ?? anyP.state,
    p.addressZip ?? anyP.zip,
  ].filter(Boolean);
  return parts.join(", ");
}

function cleanRelationshipPhrase(s?: string) {
  return (s || "").trim();
}

function deriveJointRelationshipPhrase({
  person,
  client1First,
}: {
  person?: Person;
  client1First: string;
}) {
  if (!person) return "";

  const joint = cleanRelationshipPhrase(person.relationshipPhraseJoint);
  if (joint) return joint;

  const s1 = cleanRelationshipPhrase(person.relationshipPhraseToSpouse1);
  const s2 = cleanRelationshipPhrase(person.relationshipPhraseToSpouse2);

  // If both sides entered the same first-person phrase (e.g. "my friend" / "my friend"),
  // convert to a joint phrase ("our friend").
  if (s1 && s2 && s1.toLowerCase() === s2.toLowerCase()) {
    if (s1.toLowerCase().startsWith("my ")) return `our ${s1.slice(3)}`.trim();
    return `our ${s1}`.trim();
  }

  // If spouse1 provided a first-person phrase ("my brother"), convert to "{Client1}'s brother".
  if (s1) {
    if (s1.toLowerCase().startsWith("my ")) return `${client1First}'s ${s1.slice(3)}`.trim();
    return `${client1First}'s ${s1}`.trim();
  }

  // Final fallback: legacy label.
  const rel = (person.relationship || "").trim();
  if (rel) return `${client1First}'s ${rel}`.trim();

  return "";
}

export function tokenDataFromIntake(intake: IntakeV1) {
  return tokenDataFromIntakeWithOptions(intake);
}

type TokenOptions = {
  /** For templates that use singular CLIENT* tokens (individual trust), choose which grantor is the POV client. */
  primaryClient?: 1 | 2;
  /** When true, derive trustee primary/alternate from rankedRoles spouse defaults (reciprocal trust rendering). */
  reciprocalTrustView?: boolean;
};

function findSpouses(intake: IntakeV1) {
  const [g1, g2] = intake.grantors || ["", ""];
  const norm = (s: string) => (s || "").toLowerCase().trim();
  const p1 = intake.people.find((p) => norm(p.name) === norm(g1));
  const p2 = intake.people.find((p) => norm(p.name) === norm(g2));
  return { spouse1: p1, spouse2: p2 };
}

function phraseForPov(p: Person | undefined, pov: 1 | 2) {
  if (!p) return "";
  return (pov === 2 ? p.relationshipPhraseToSpouse2 : p.relationshipPhraseToSpouse1) || p.relationship || "";
}

export function tokenDataFromIntakeWithOptions(intake: IntakeV1, options?: TokenOptions) {
  const client1 = intake.grantors[0] ?? "";
  const client2 = intake.grantors[1] ?? "";
  const povClient: 1 | 2 = options?.primaryClient ?? 1;
  const povName = povClient === 2 ? client2 : client1;
  const povFirst = povName.split(" ")[0] ?? "";
  const povSurname = povName.trim().split(/\s+/).slice(-1)[0] ?? "";

  const spouseName = povClient === 2 ? client1 : client2;
  const spouseFirst = spouseName.split(" ")[0] ?? "";
  const spouseSurname = spouseName.trim().split(/\s+/).slice(-1)[0] ?? "";

  const rawOverride = (intake.trustNameOverride || "").trim();
  const normalizedOverride = rawOverride
    ? rawOverride.replace(/^the\s+/i, "").trim()
    : "";

  const trustNameBase = normalizedOverride || defaultTrustNameFromClient1(povName || client1);
  const trustName = trustNameBase.toUpperCase();

  const client1First = client1.split(" ")[0] ?? "";
  const client2First = client2.split(" ")[0] ?? "";
  const client1Surname = client1.trim().split(/\s+/).slice(-1)[0] ?? "";
  const client2Surname = client2.trim().split(/\s+/).slice(-1)[0] ?? "";
  const clientState = intake.clientAddress.state;

  const data: Record<string, unknown> = {
    // canonical
    Client1FullName: client1,
    Client2FullName: client2,
    CLIENT1FULLNAME: client1,
    CLIENT2FULLNAME: client2,

    // Common legacy casing variants
    Client1Fullname: client1,
    Client2Fullname: client2,

    Client1FirstName: client1First,
    Client2FirstName: client2First,
    CLIENT1FIRSTNAME: client1First,
    CLIENT2FIRSTNAME: client2First,

    Client1Firstname: client1First,
    Client2Firstname: client2First,

    Client1Surname: client1Surname,
    Client2Surname: client2Surname,

    ClientTrustName: trustName,
    CLIENTTRUSTNAME: trustName,
    Clienttrustname: trustName,

    ClientStreetAddress: intake.clientAddress.street,
    ClientCity: intake.clientAddress.city,
    ClientState: clientState,
    CLIENTSTATE: clientState,

    // Templates sometimes use these combined labels.
    "County/City": intake.clientAddress.city,
    "ClientCity/County": intake.clientAddress.city,
    "ClientCounty/City": intake.clientAddress.city,

    Zip: intake.clientAddress.zip,

    // Individual-trust templates sometimes use singular CLIENT* tokens.
    CLIENTFULLNAME: povName,
    CLIENTFIRSTNAME: povFirst,
    CLIENTSURNAME: povSurname,
    Clientfirstname: povFirst,
    Clientsurname: povSurname,
    CLIENTINITIALS: "",
    CLIENTemail: povClient === 2 ? (intake.clientEmails?.client2 ?? "") : (intake.clientEmails?.client1 ?? ""),

    // Reciprocal-trust helper tokens (spouse POV)
    SPOUSEFULLNAME: spouseName,
    SPOUSEFIRSTNAME: spouseFirst,
    SPOUSESURNAME: spouseSurname,
    SpouseFullName: spouseName,
    SpouseFirstName: spouseFirst,
    SpouseSurname: spouseSurname,
    SPOUSEFirstname: spouseFirst,
    SpouseFirstname: spouseFirst,
  
    // Law firm (legacy individual template tokens)
    "LawFirmCounty/City": "Alexandria",
    LawFirmCountyOrCity: "Alexandria",
  
    // If templates still reference initials tokens, keep them defined (empty by design).
    S1INITIALS: "",
    S2INITIALS: "",

    // Legacy placeholder sometimes appears as [NotaryRegistrationNumber] in older templates.
    // IntakeV1 doesn't currently collect it, so default to blank rather than leaking placeholder text.
    NotaryRegistrationNumber: "",

    // Notary expiration date is not collected in the MVP.
    NotaryExpirationDate: "",
    NOTARYNAME: "",

    // Email legacy variants
    Client1email: intake.clientEmails?.client1 ?? "",
    Client2email: intake.clientEmails?.client2 ?? "",
  };

  // Trust protector (optional). Templates must include the relevant tokens/conditionals.
  const tpEnabled = Boolean(intake.trustProtector?.enabled);
  const tpName = (intake.trustProtector?.name || "").trim();
  data.TrustProtectorEnabled = tpEnabled ? "YES" : "";
  data.TRUSTPROTECTORENABLED = tpEnabled ? "YES" : "";
  data.TrustProtectorName = tpName;
  data.TRUSTPROTECTORNAME = tpName;

  // Children (MVP: first two only)
  const c1 = intake.children?.[0];
  const c2 = intake.children?.[1];
  data.CHILD1FULLNAME = c1?.name ?? "";
  data.CHILD2FULLNAME = c2?.name ?? "";
  data.CHILD1DOB = c1?.dob ?? "";
  data.CHILD2DOB = c2?.dob ?? "";

  const child1First = (c1?.name ?? "").split(" ")[0] ?? "";
  data.CHILDFIRSTNAME = child1First;
  data.CHILD1FIRSTNAME = child1First;

  // Guardians
  const gPrimary = byId(intake.people, intake.roles.guardians.primary);
  const gA1 = byId(intake.people, intake.roles.guardians.alternate1);
  const gA2 = byId(intake.people, intake.roles.guardians.alternate2);

  // Individual template (legacy) expects explicit primary guardian tokens.
  data.PRIMARYGUARDIANFULLNAME = gPrimary?.name ?? "";
  data.PRIMARYGUARDIANRELATIONSHIP = cleanRelationshipPhrase(phraseForPov(gPrimary, povClient));
  data.FIRSTALTERNATEGUARDIANRELATIONSHIP = cleanRelationshipPhrase(phraseForPov(gA1, povClient));

  // Will template tokens (client1-based)
  data.CLIENT1FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? "";
  data.CLIENT1SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";

  // Legacy individual template tokens (no client number + weird casing)
  data.CLIENTFIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? "";
  data.CLIENTSECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";
  data.CLIENTFIRSTALTERNATEGUARDIANRelationship =
    cleanRelationshipPhrase(phraseForPov(gA1, povClient));
  data.CLIENTSECONDALTERNATEGUARDIANRelationship =
    cleanRelationshipPhrase(phraseForPov(gA2, povClient));

  // Some templates reference the same guardians under client2 token names.
  data.CLIENT2FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? "";
  data.CLIENT2SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";

  // Minor-children doc tokens
  data.FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? gPrimary?.name ?? "";
  data.SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";

  // Relationship/address variants
  // Prefer phrase tokens when available.
  data.Client1FirstAlternateGuardianRelationship =
    cleanRelationshipPhrase(gA1?.relationshipPhraseToSpouse1) || (gA1?.relationship ?? "");
  data.Client1SecondAlternateGuardianRelationship =
    cleanRelationshipPhrase(gA2?.relationshipPhraseToSpouse1) || (gA2?.relationship ?? "");
  data.Client2FirstAlternateGuardianRelationship =
    cleanRelationshipPhrase(gA1?.relationshipPhraseToSpouse2) || (gA1?.relationship ?? "");
  data.Client2SecondAlternateGuardianRelationship =
    cleanRelationshipPhrase(gA2?.relationshipPhraseToSpouse2) || (gA2?.relationship ?? "");

  // Template uses these exact tokens in at least one joint template.
  data.firstalternateguardianrelationshiptospouse1 =
    cleanRelationshipPhrase(gA1?.relationshipPhraseToSpouse1) || (gA1?.relationship ?? "");
  data.firstalternateguardianrelationshiptospouse2 =
    cleanRelationshipPhrase(gA1?.relationshipPhraseToSpouse2) || (gA1?.relationship ?? "");
  data.secondalternateguardianrelationshiptospouse1 =
    cleanRelationshipPhrase(gA2?.relationshipPhraseToSpouse1) || (gA2?.relationship ?? "");
  data.secondalternateguardianrelationshiptospouse2 =
    cleanRelationshipPhrase(gA2?.relationshipPhraseToSpouse2) || (gA2?.relationship ?? "");

  // New joint-POV relationship phrase tokens (used by joint docs to avoid hardcoding "our").
  data.FIRSTALTERNATEGUARDIANRELATIONSHIPPHRASEJOINT = deriveJointRelationshipPhrase({
    person: gA1,
    client1First,
  });
  data.SECONDALTERNATEGUARDIANRELATIONSHIPPHRASEJOINT = deriveJointRelationshipPhrase({
    person: gA2,
    client1First,
  });

  data.Client1FirstAlternateGuardianAddress = formatAddress(gA1);
  data.Client1SecondAlternateGuardianAddress = formatAddress(gA2);
  data.Client2FirstAlternateGuardianAddress = formatAddress(gA1);
  data.Client2FSecondAlternateGuardianAddress = formatAddress(gA2);
  data.Client2SecondAlternateGuardianAddress = formatAddress(gA2);

  // Trustees
  const tA1 = byId(intake.people, intake.roles.trustees.alternate1);
  const tA2 = byId(intake.people, intake.roles.trustees.alternate2);

  // Some intake shapes store successor trustees as raw names (string[]) instead of personIds.
  // Use as a fallback so the Joint Trust "succeeded by ___ as the successor Trustee" clause doesn't go blank.
  const succ1 = intake.successorTrustees?.[0] ?? "";
  const succ2 = intake.successorTrustees?.[1] ?? "";

  const trusteeAlt1Name = tA1?.name ?? succ1;
  const trusteeAlt2Name = tA2?.name ?? succ2;
  const trusteeAlt1Rel = tA1?.relationship ?? "";
  const trusteeAlt2Rel = tA2?.relationship ?? "";

  data.FIRSTALTERNATETRUSTEEFULLNAME = trusteeAlt1Name;
  data.SECONDALTERNATETRUSTEEFULLNAME = trusteeAlt2Name;
  data.FIRSTALTERNATETRUSTEERelationship = trusteeAlt1Rel;
  data.SECONDALTERNATETRUSTEERelationship = trusteeAlt2Rel;

  // Legacy individual template token: expects a relationship phrase that stands alone after
  // "succeeded by" (original template paired it with a separate Jinja-inserted name).
  data.CLIENTFirstAlternateTrusteeRelationship = trusteeAlt1Rel
    ? `my ${trusteeAlt1Rel}`.trim()
    : "";

  // Some templates expect these as client-scoped trustee alternates.
  data.CLIENT1FIRSTALTERNATETRUSTEEFULLNAME = trusteeAlt1Name;
  data.CLIENT1SECONDALTERNATETRUSTEEFULLNAME = trusteeAlt2Name;
  data.CLIENT2FIRSTALTERNATETRUSTEEFULLNAME = trusteeAlt1Name;
  data.CLIENT2SECONDALTERNATETRUSTEEFULLNAME = trusteeAlt2Name;

  // POA agents (templates use a mix of casing)
  const poaP = byId(intake.people, intake.roles.financialAgents.primary);
  const poaA1 = byId(intake.people, intake.roles.financialAgents.alternate1);
  const poaA2 = byId(intake.people, intake.roles.financialAgents.alternate2);

  data.CLIENT1POAFULLNAME = poaP?.name ?? "";
  data.CLIENT1POAPHONENUMBER = poaP?.phone ?? "";
  data.Client1POAEmail = poaP?.email ?? "";
  data.Client1POAAddress = formatAddress(poaP);

  data.CLIENT1FIRSTALTERNATEPOAFULLNAME = poaA1?.name ?? "";
  data.CLIENT1SECONDALTERNATEPOAFULLNAME = poaA2?.name ?? "";
  data.client1firstalternatepoarelationship =
    cleanRelationshipPhrase(poaA1?.relationshipPhraseToSpouse1) || (poaA1?.relationship ?? "");
  data.client1secondalternatepoarelationship =
    cleanRelationshipPhrase(poaA2?.relationshipPhraseToSpouse1) || (poaA2?.relationship ?? "");
  data.client1firstalternatepoaphonenumber = poaA1?.phone ?? "";
  data.client1secondalternatepoaphonenumber = poaA2?.phone ?? "";
  data.Client1FirstAlternatePOAEmail = poaA1?.email ?? "";
  data.Client1SecondAlternatePOAEmail = poaA2?.email ?? "";
  data.Client1FirstAlternatePOAAddress = formatAddress(poaA1);
  data.Client1SecondAlternatePOAAddress = formatAddress(poaA2);

  // Legacy individual template tokens (no client number + inconsistent casing)
  data.CLIENTFIRSTALTERNATEPOAFULLNAME = poaA1?.name ?? "";
  data.CLIENTSECONDALTERNATEPOAFULLNAME = poaA2?.name ?? "";
  data.CLIENTFirstalternatepoafullname = poaA1?.name ?? "";
  data.CLIENTFIRSTALTERNATEPOAAddress = formatAddress(poaA1);
  data.CLIENTSECONDALTERNATEPOAAddress = formatAddress(poaA2);
  data.CLIENTFIRSTALTERNATEPOARelationship =
    cleanRelationshipPhrase(phraseForPov(poaA1, povClient));
  data.CLIENTSECONDALTERNATEPOARelationship =
    cleanRelationshipPhrase(phraseForPov(poaA2, povClient));
  data.CLIENTsecondalternatepoarelationship =
    cleanRelationshipPhrase(phraseForPov(poaA2, povClient));

  // AMD agents (best-effort)
  const amdP = byId(intake.people, intake.roles.healthAgents.primary);
  const amdA1 = byId(intake.people, intake.roles.healthAgents.alternate1);
  const amdA2 = byId(intake.people, intake.roles.healthAgents.alternate2);

  data.CLIENT1AMDFULLNAME = amdP?.name ?? "";
  data.CLIENT1AMDPHONENUMBER = amdP?.phone ?? "";
  data.Client1AMDEmail = amdP?.email ?? "";
  data.Client1AMDAddress = formatAddress(amdP);

  data.CLIENT1FIRSTALTERNATEAMDFULLNAME = amdA1?.name ?? "";
  data.CLIENT1SECONDALTERNATEAMDFULLNAME = amdA2?.name ?? "";
  data.client1firstalternateamdrelationship =
    cleanRelationshipPhrase(amdA1?.relationshipPhraseToSpouse1) || (amdA1?.relationship ?? "");
  // Legacy casing variant
  data.CLIENTfirstalternateamdrelationship =
    cleanRelationshipPhrase(amdA1?.relationshipPhraseToSpouse1) || (amdA1?.relationship ?? "");
  data.client1secondalternateamdrelationship =
    cleanRelationshipPhrase(amdA2?.relationshipPhraseToSpouse1) || (amdA2?.relationship ?? "");
  data.client1firstalternateamdphonenumber = amdA1?.phone ?? "";
  data.client1secondalternateamdphonenumber = amdA2?.phone ?? "";
  data.Client1FirstAlternateAMDEmail = amdA1?.email ?? "";
  data.Client1SecondAlternateAMDEmail = amdA2?.email ?? "";
  data.Client1FirstAlternateAMDAddress = formatAddress(amdA1);
  data.Client1SecondAlternateAMDAddress = formatAddress(amdA2);

  // Legacy individual template tokens (no client number + inconsistent casing)
  data.CLIENTFIRSTALTERNATEAMDFULLNAME = amdA1?.name ?? "";
  data.CLIENTSECONDALTERNATEAMDFULLNAME = amdA2?.name ?? "";
  data.CLIENTFIRSTALTERNATEAMDAddress = formatAddress(amdA1);
  data.CLIENTSECONDALTERNATEAMDAddress = formatAddress(amdA2);
  data.CLIENTFIRSTALTERNATEAMDRelationship =
    cleanRelationshipPhrase(phraseForPov(amdA1, povClient));
  data.CLIENTSECONDALTERNATEAMDRelationship =
    cleanRelationshipPhrase(phraseForPov(amdA2, povClient));

  // Reciprocal trust rendering: override trustee primary/alternate based on spouse POV.
  // This is intentionally local to the individual/reciprocal trust docs so we don't disturb
  // the existing joint-trust and packet-split docs.
  if (options?.reciprocalTrustView) {
    const { spouse1, spouse2 } = findSpouses(intake);
    const povSpouse = povClient === 2 ? spouse2 : spouse1;
    const otherSpouse = povClient === 2 ? spouse1 : spouse2;

    if (povSpouse?.id) {
      // Primary trustee is the trustor.
      const alt1Name = otherSpouse?.name ?? "";
      const alt2Id = intake.rankedRoles?.trustees?.[1]?.personIds?.[0];
      const alt2 = byId(intake.people, alt2Id);
      const alt2Name = alt2?.name ?? "";

      data.FIRSTALTERNATETRUSTEEFULLNAME = alt1Name;
      data.SECONDALTERNATETRUSTEEFULLNAME = alt2Name;
      data.CLIENT1FIRSTALTERNATETRUSTEEFULLNAME = alt1Name;
      data.CLIENT1SECONDALTERNATETRUSTEEFULLNAME = alt2Name;
      data.CLIENT2FIRSTALTERNATETRUSTEEFULLNAME = alt1Name;
      data.CLIENT2SECONDALTERNATETRUSTEEFULLNAME = alt2Name;
    }
  }

  // Mirror for client2 where tokens exist in templates
  const poa2P = byId(intake.people, intake.roles.financialAgents.primary);
  const poa2A1 = byId(intake.people, intake.roles.financialAgents.alternate1);
  const poa2A2 = byId(intake.people, intake.roles.financialAgents.alternate2);

  data.CLIENT2POAFULLNAME = poa2P?.name ?? "";
  data.CLIENT2POAPHONENUMBER = poa2P?.phone ?? "";
  data.Client2POAEmail = poa2P?.email ?? "";
  data.Client2POAAddress = formatAddress(poa2P);

  data.CLIENT2FIRSTALTERNATEPOAFULLNAME = poa2A1?.name ?? "";
  data.CLIENT2SECONDALTERNATEPOAFULLNAME = poa2A2?.name ?? "";
  data.client2firstalternatepoarelationship =
    cleanRelationshipPhrase(poa2A1?.relationshipPhraseToSpouse2) || (poa2A1?.relationship ?? "");
  data.client2secondalternatepoarelationship =
    cleanRelationshipPhrase(poa2A2?.relationshipPhraseToSpouse2) || (poa2A2?.relationship ?? "");
  data.client2firstalternatepoaphonenumber = poa2A1?.phone ?? "";
  data.client2secondalternatepoaphonenumber = poa2A2?.phone ?? "";
  data.Client2FirstAlternatePOAEmail = poa2A1?.email ?? "";
  data.Client2SecondAlternatePOAEmail = poa2A2?.email ?? "";
  data.Client2FirstAlternatePOAAddress = formatAddress(poa2A1);
  data.Client2SecondAlternatePOAAddress = formatAddress(poa2A2);

  const amd2P = byId(intake.people, intake.roles.healthAgents.primary);
  const amd2A1 = byId(intake.people, intake.roles.healthAgents.alternate1);
  const amd2A2 = byId(intake.people, intake.roles.healthAgents.alternate2);

  data.CLIENT2AMDFULLNAME = amd2P?.name ?? "";
  data.CLIENT2AMDPHONENUMBER = amd2P?.phone ?? "";
  data.Client2AMDEmail = amd2P?.email ?? "";
  data.Client2AMDAddress = formatAddress(amd2P);

  data.CLIENT2FIRSTALTERNATEAMDFULLNAME = amd2A1?.name ?? "";
  data.CLIENT2SECONDALTERNATEAMDFULLNAME = amd2A2?.name ?? "";
  data.client2firstalternateamdrelationship =
    cleanRelationshipPhrase(amd2A1?.relationshipPhraseToSpouse2) || (amd2A1?.relationship ?? "");
  data.client2secondalternateamdrelationship =
    cleanRelationshipPhrase(amd2A2?.relationshipPhraseToSpouse2) || (amd2A2?.relationship ?? "");
  data.client2firstalternateamdphonenumber = amd2A1?.phone ?? "";
  data.client2secondalternateamdphonenumber = amd2A2?.phone ?? "";
  data.Client2FirstAlternateAMDEmail = amd2A1?.email ?? "";
  data.Client2SecondAlternateAMDEmail = amd2A2?.email ?? "";
  data.Client2FirstAlternateAMDAddress = formatAddress(amd2A1);
  data.Client2SecondAlternateAMDAddress = formatAddress(amd2A2);

  return data;
}
