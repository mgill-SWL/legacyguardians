import type { IntakeV1, Person } from "./intakeTypes";
import { defaultTrustNameFromClient1 } from "./names";

function byId(people: Person[], id?: string) {
  if (!id) return undefined;
  return people.find((p) => p.id === id);
}

function formatAddress(p?: Person) {
  if (!p) return "";
  const parts = [p.addressStreet, p.addressCity, p.addressState, p.addressZip].filter(Boolean);
  return parts.join(", ");
}

export function tokenDataFromIntake(intake: IntakeV1) {
  const client1 = intake.grantors[0] ?? "";
  const client2 = intake.grantors[1] ?? "";

  const rawOverride = (intake.trustNameOverride || "").trim();
  const normalizedOverride = rawOverride
    ? rawOverride.replace(/^the\s+/i, "").trim()
    : "";

  const trustNameBase = normalizedOverride || defaultTrustNameFromClient1(client1);
  const trustName = trustNameBase.toUpperCase();

  const client1First = client1.split(" ")[0] ?? "";
  const client2First = client2.split(" ")[0] ?? "";
  const client1Surname = client1.trim().split(/\s+/).slice(-1)[0] ?? "";
  const client2Surname = client2.trim().split(/\s+/).slice(-1)[0] ?? "";

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

    // Templates sometimes use these combined labels.
    "County/City": intake.clientAddress.city,
    "ClientCity/County": intake.clientAddress.city,

    Zip: intake.clientAddress.zip,

    // If templates still reference initials tokens, keep them defined (empty by design).
    S1INITIALS: "",
    S2INITIALS: "",

    // Legacy placeholder sometimes appears as [NotaryRegistrationNumber] in older templates.
    // IntakeV1 doesn't currently collect it, so default to blank rather than leaking placeholder text.
    NotaryRegistrationNumber: "",

    // Email legacy variants
    Client1email: intake.clientEmails?.client1 ?? "",
    Client2email: intake.clientEmails?.client2 ?? "",
  };

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

  // Will template tokens (client1-based)
  data.CLIENT1FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? "";
  data.CLIENT1SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";

  // Some templates reference the same guardians under client2 token names.
  data.CLIENT2FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? "";
  data.CLIENT2SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";

  // Minor-children doc tokens
  data.FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? gPrimary?.name ?? "";
  data.SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";

  // Relationship/address variants
  data.Client1FirstAlternateGuardianRelationship = gA1?.relationship ?? "";
  data.Client1SecondAlternateGuardianRelationship = gA2?.relationship ?? "";
  data.Client2FirstAlternateGuardianRelationship = gA1?.relationship ?? "";
  data.Client2SecondAlternateGuardianRelationship = gA2?.relationship ?? "";

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
  data.client1firstalternatepoarelationship = poaA1?.relationship ?? "";
  data.client1secondalternatepoarelationship = poaA2?.relationship ?? "";
  data.client1firstalternatepoaphonenumber = poaA1?.phone ?? "";
  data.client1secondalternatepoaphonenumber = poaA2?.phone ?? "";
  data.Client1FirstAlternatePOAEmail = poaA1?.email ?? "";
  data.Client1SecondAlternatePOAEmail = poaA2?.email ?? "";
  data.Client1FirstAlternatePOAAddress = formatAddress(poaA1);
  data.Client1SecondAlternatePOAAddress = formatAddress(poaA2);

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
  data.client1firstalternateamdrelationship = amdA1?.relationship ?? "";
  data.client1secondalternateamdrelationship = amdA2?.relationship ?? "";
  data.client1firstalternateamdphonenumber = amdA1?.phone ?? "";
  data.client1secondalternateamdphonenumber = amdA2?.phone ?? "";
  data.Client1FirstAlternateAMDEmail = amdA1?.email ?? "";
  data.Client1SecondAlternateAMDEmail = amdA2?.email ?? "";
  data.Client1FirstAlternateAMDAddress = formatAddress(amdA1);
  data.Client1SecondAlternateAMDAddress = formatAddress(amdA2);

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
  data.client2firstalternatepoarelationship = poa2A1?.relationship ?? "";
  data.client2secondalternatepoarelationship = poa2A2?.relationship ?? "";
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
  data.client2firstalternateamdrelationship = amd2A1?.relationship ?? "";
  data.client2secondalternateamdrelationship = amd2A2?.relationship ?? "";
  data.client2firstalternateamdphonenumber = amd2A1?.phone ?? "";
  data.client2secondalternateamdphonenumber = amd2A2?.phone ?? "";
  data.Client2FirstAlternateAMDEmail = amd2A1?.email ?? "";
  data.Client2SecondAlternateAMDEmail = amd2A2?.email ?? "";
  data.Client2FirstAlternateAMDAddress = formatAddress(amd2A1);
  data.Client2SecondAlternateAMDAddress = formatAddress(amd2A2);

  return data;
}
