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

  const data: Record<string, unknown> = {
    // canonical
    Client1FullName: client1,
    Client2FullName: client2,
    CLIENT1FULLNAME: client1,
    CLIENT2FULLNAME: client2,

    ClientTrustName: trustName,
    CLIENTTRUSTNAME: trustName,

    ClientStreetAddress: intake.clientAddress.street,
    ClientCity: intake.clientAddress.city,
    Zip: intake.clientAddress.zip,

    CLIENT2FIRSTNAME: client2.split(" ")[0] ?? "",
    Client1FirstName: client1.split(" ")[0] ?? "",
    Client2FirstName: client2.split(" ")[0] ?? "",
  };

  // Children (MVP: first two only)
  const c1 = intake.children?.[0];
  const c2 = intake.children?.[1];
  data.CHILD1FULLNAME = c1?.name ?? "";
  data.CHILD2FULLNAME = c2?.name ?? "";
  data.CHILD1DOB = c1?.dob ?? "";
  data.CHILD2DOB = c2?.dob ?? "";

  // Guardians
  const gPrimary = byId(intake.people, intake.roles.guardians.primary);
  const gA1 = byId(intake.people, intake.roles.guardians.alternate1);
  const gA2 = byId(intake.people, intake.roles.guardians.alternate2);

  // Will template tokens (client1-based)
  data.CLIENT1FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? "";
  data.CLIENT1SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";

  // Minor-children doc tokens
  data.FIRSTALTERNATEGUARDIANFULLNAME = gA1?.name ?? gPrimary?.name ?? "";
  data.SECONDALTERNATEGUARDIANFULLNAME = gA2?.name ?? "";
  data.Client1FirstAlternateGuardianRelationship = gA1?.relationship ?? "";
  data.Client1SecondAlternateGuardianRelationship = gA2?.relationship ?? "";
  data.Client1FirstAlternateGuardianAddress = formatAddress(gA1);
  data.Client1SecondAlternateGuardianAddress = formatAddress(gA2);

  // POA alternates (templates use a mix of casing)
  const poaA1 = byId(intake.people, intake.roles.financialAgents.alternate1);
  const poaA2 = byId(intake.people, intake.roles.financialAgents.alternate2);

  data.CLIENT1FIRSTALTERNATEPOAFULLNAME = poaA1?.name ?? "";
  data.CLIENT1SECONDALTERNATEPOAFULLNAME = poaA2?.name ?? "";
  data.client1firstalternatepoarelationship = poaA1?.relationship ?? "";
  data.client1secondalternatepoarelationship = poaA2?.relationship ?? "";
  data.Client1FirstAlternatePOAEmail = poaA1?.email ?? "";
  data.Client1SecondAlternatePOAEmail = poaA2?.email ?? "";
  data.Client1FirstAlternatePOAAddress = formatAddress(poaA1);
  data.Client1SecondAlternatePOAAddress = formatAddress(poaA2);

  // AMD alternates (best-effort)
  const amdA1 = byId(intake.people, intake.roles.healthAgents.alternate1);
  const amdA2 = byId(intake.people, intake.roles.healthAgents.alternate2);

  data.CLIENT1FIRSTALTERNATEAMDFULLNAME = amdA1?.name ?? "";
  data.CLIENT1SECONDALTERNATEAMDFULLNAME = amdA2?.name ?? "";
  data.client1firstalternateamdrelationship = amdA1?.relationship ?? "";
  data.client1secondalternateamdrelationship = amdA2?.relationship ?? "";
  data.Client1FirstAlternateAMDEmail = amdA1?.email ?? "";
  data.Client1FirstAlternateAMDAddress = formatAddress(amdA1);
  data.Client1SecondAlternateAMDAddress = formatAddress(amdA2);

  // Mirror for client2 where tokens exist in templates
  const poa2A1 = byId(intake.people, intake.roles.financialAgents.alternate1);
  const poa2A2 = byId(intake.people, intake.roles.financialAgents.alternate2);
  data.CLIENT2FIRSTALTERNATEPOAFULLNAME = poa2A1?.name ?? "";
  data.CLIENT2SECONDALTERNATEPOAFULLNAME = poa2A2?.name ?? "";
  data.client2firstalternatepoarelationship = poa2A1?.relationship ?? "";
  data.client2secondalternatepoarelationship = poa2A2?.relationship ?? "";
  data.Client2FirstAlternatePOAEmail = poa2A1?.email ?? "";
  data.Client2SecondAlternatePOAEmail = poa2A2?.email ?? "";
  data.Client2FirstAlternatePOAAddress = formatAddress(poa2A1);
  data.Client2SecondAlternatePOAAddress = formatAddress(poa2A2);

  const amd2A1 = byId(intake.people, intake.roles.healthAgents.alternate1);
  const amd2A2 = byId(intake.people, intake.roles.healthAgents.alternate2);
  data.CLIENT2FIRSTALTERNATEAMDFULLNAME = amd2A1?.name ?? "";
  data.CLIENT2SECONDALTERNATEAMDFULLNAME = amd2A2?.name ?? "";
  data.client2firstalternateamdrelationship = amd2A1?.relationship ?? "";
  data.client2secondalternateamdrelationship = amd2A2?.relationship ?? "";
  data.Client2FirstAlternateAMDEmail = amd2A1?.email ?? "";
  data.Client2FirstAlternateAMDAddress = formatAddress(amd2A1);
  data.Client2SecondAlternateAMDAddress = formatAddress(amd2A2);

  return data;
}
