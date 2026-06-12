import type { IntakeV1, Person, RoleAssignment } from "./intakeTypes";
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

/** Format an ISO YYYY-MM-DD date as a spelled-out legal date (e.g. "March 14, 2022"); pass through anything else as written. */
function legalDate(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return trimmed;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
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

type RoleKey = "trustees" | "executors" | "financialAgents" | "healthAgents" | "guardians";

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object";
}

function toRoleAssignment(x: unknown): RoleAssignment {
  if (!isRecord(x)) return {};
  return {
    primary: typeof x.primary === "string" ? x.primary : undefined,
    alternate1: typeof x.alternate1 === "string" ? x.alternate1 : undefined,
    alternate2: typeof x.alternate2 === "string" ? x.alternate2 : undefined,
  };
}

function roleForClient(intake: IntakeV1, roleKey: RoleKey, client: 1 | 2): RoleAssignment {
  const raw = (intake.roles as Record<RoleKey, unknown> | undefined)?.[roleKey];
  if (!isRecord(raw)) return {};

  // Legacy shape: a single RoleAssignment applied to both clients.
  if ("primary" in raw || "alternate1" in raw || "alternate2" in raw) {
    return toRoleAssignment(raw);
  }

  // Newer shape: { client1: RoleAssignment, client2: RoleAssignment }
  const key = client === 2 ? "client2" : "client1";
  return toRoleAssignment(raw[key]);
}

function finalDispositionRanksForClient(intake: IntakeV1, client: 1 | 2): string[][] {
  const raw: unknown = (intake.roles as Record<string, unknown> | undefined)?.finalDispositionAgents;
  const key = client === 2 ? "client2" : "client1";

  const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");
  const isRankArr = (v: unknown): v is string[][] => Array.isArray(v) && v.every((r) => isStrArr(r));

  // Preferred: { client1: string[][], client2: string[][] }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const v = rec[key];
    if (isRankArr(v)) return v;

    // Legacy RoleAssignment shapes: { primary, alternate1, alternate2 }
    if ("primary" in rec || "alternate1" in rec || "alternate2" in rec) {
      const list = [rec.primary, rec.alternate1, rec.alternate2].filter((x): x is string => typeof x === "string");
      return [list.slice(0, 1), ...list.slice(1).map((id) => [id])].filter((r) => r.length);
    }

    // Legacy by-client role assignment shapes
    if ("client1" in rec || "client2" in rec) {
      const r = rec[key];
      if (r && typeof r === "object") {
        const rr2 = r as Record<string, unknown>;
        const list = [rr2.primary, rr2.alternate1, rr2.alternate2].filter((x): x is string => typeof x === "string");
        return [list.slice(0, 1), ...list.slice(1).map((id) => [id])].filter((rr) => rr.length);
      }
    }
  }

  // Legacy flat list: string[] applied to both.
  if (isStrArr(raw)) {
    const list = raw as string[];
    return [list.slice(0, 1), ...list.slice(1).map((id) => [id])].filter((r) => r.length);
  }

  // Fallback: if not provided, default to spouse as representative (matches the golden templates).
  const { spouse1, spouse2 } = findSpouses(intake);
  const spouse = client === 2 ? spouse1 : spouse2;
  return spouse?.id ? [[spouse.id]] : [[]];
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

  const reciprocal = Boolean(options?.reciprocalTrustView);

  const rawOverride = (
    (povClient === 1
      ? intake.trustNameOverridesByClient?.client1
      : intake.trustNameOverridesByClient?.client2) ||
    intake.trustNameOverride ||
    ""
  ).trim();
  const normalizedOverride = rawOverride
    ? rawOverride.replace(/^the\s+/i, "").trim()
    : "";

  // Naming convention: reciprocal trusts are each titled "<Grantor's Full Legal Name>
  // Living Trust" so the spouse's residue clause cross-reference resolves to a real
  // instrument. Joint/individual trusts keep the "<Surname> Family Living Trust" default.
  const trustNameBase =
    normalizedOverride ||
    (reciprocal && povName
      ? `${povName} LIVING TRUST`
      : defaultTrustNameFromClient1(povName || client1));
  const trustName = trustNameBase.toUpperCase();

  // Spouse's trust name (override-aware) for reciprocal cross-references.
  const spouseRawOverride = (
    (povClient === 1
      ? intake.trustNameOverridesByClient?.client2
      : intake.trustNameOverridesByClient?.client1) || ""
  ).trim();
  const spouseNormalizedOverride = spouseRawOverride
    ? spouseRawOverride.replace(/^the\s+/i, "").trim()
    : "";
  const spouseTrustName = (
    spouseNormalizedOverride || (spouseName ? `${spouseName} LIVING TRUST` : "")
  ).toUpperCase();

  // "executed ... concurrently herewith" for a new trust, or "under date of trust
  // <original date>" when the spouse's trust is a restatement of an existing trust.
  const spouseOriginalDateRaw = (
    (povClient === 1
      ? intake.trustOriginalDatesByClient?.client2
      : intake.trustOriginalDatesByClient?.client1) || ""
  ).trim();
  const spouseTrustExecution = spouseOriginalDateRaw
    ? `under date of trust ${legalDate(spouseOriginalDateRaw)}`
    : "concurrently herewith";

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
    SPOUSETRUSTNAME: spouseTrustName,
    SpouseTrustName: spouseTrustName,
    SPOUSETRUSTEXECUTION: spouseTrustExecution,
  
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
    // Notary signature line (used when templates are normalized to tokens at render-time).
    NOTARYSIGNATURELINE: "_________________________________________",

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
  const gRole = roleForClient(intake, "guardians", povClient);
  const gPrimary = byId(intake.people, gRole.primary);
  const gA1 = byId(intake.people, gRole.alternate1);
  const gA2 = byId(intake.people, gRole.alternate2);

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
  const trusteeRolePov = roleForClient(intake, "trustees", povClient);
  const trusteeRole1 = roleForClient(intake, "trustees", 1);
  const trusteeRole2 = roleForClient(intake, "trustees", 2);

  const tA1 = byId(intake.people, trusteeRolePov.alternate1);
  const tA2 = byId(intake.people, trusteeRolePov.alternate2);

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
  const t1A1 = byId(intake.people, trusteeRole1.alternate1);
  const t1A2 = byId(intake.people, trusteeRole1.alternate2);
  const t2A1 = byId(intake.people, trusteeRole2.alternate1);
  const t2A2 = byId(intake.people, trusteeRole2.alternate2);

  data.CLIENT1FIRSTALTERNATETRUSTEEFULLNAME = t1A1?.name ?? "";
  data.CLIENT1SECONDALTERNATETRUSTEEFULLNAME = t1A2?.name ?? "";
  data.CLIENT2FIRSTALTERNATETRUSTEEFULLNAME = t2A1?.name ?? "";
  data.CLIENT2SECONDALTERNATETRUSTEEFULLNAME = t2A2?.name ?? "";

  // POA agents (templates use a mix of casing)
  const poaRolePov = roleForClient(intake, "financialAgents", povClient);
  const poaRole1 = roleForClient(intake, "financialAgents", 1);
  const poaRole2 = roleForClient(intake, "financialAgents", 2);

  const poaP = byId(intake.people, poaRole1.primary);
  const poaA1 = byId(intake.people, poaRole1.alternate1);
  const poaA2 = byId(intake.people, poaRole1.alternate2);

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
  const poaPovA1 = byId(intake.people, poaRolePov.alternate1);
  const poaPovA2 = byId(intake.people, poaRolePov.alternate2);

  data.CLIENTFIRSTALTERNATEPOAFULLNAME = poaPovA1?.name ?? "";
  data.CLIENTSECONDALTERNATEPOAFULLNAME = poaPovA2?.name ?? "";
  data.CLIENTFirstalternatepoafullname = poaPovA1?.name ?? "";
  data.CLIENTFIRSTALTERNATEPOAAddress = formatAddress(poaPovA1);
  data.CLIENTSECONDALTERNATEPOAAddress = formatAddress(poaPovA2);
  data.CLIENTFIRSTALTERNATEPOARelationship = cleanRelationshipPhrase(phraseForPov(poaPovA1, povClient));
  data.CLIENTSECONDALTERNATEPOARelationship = cleanRelationshipPhrase(phraseForPov(poaPovA2, povClient));
  data.CLIENTsecondalternatepoarelationship = cleanRelationshipPhrase(phraseForPov(poaPovA2, povClient));

  // AMD agents (best-effort)
  const amdRolePov = roleForClient(intake, "healthAgents", povClient);
  const amdRole1 = roleForClient(intake, "healthAgents", 1);
  const amdRole2 = roleForClient(intake, "healthAgents", 2);

  const amdP = byId(intake.people, amdRole1.primary);
  const amdA1 = byId(intake.people, amdRole1.alternate1);
  const amdA2 = byId(intake.people, amdRole1.alternate2);

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
  const amdPovA1 = byId(intake.people, amdRolePov.alternate1);
  const amdPovA2 = byId(intake.people, amdRolePov.alternate2);

  data.CLIENTFIRSTALTERNATEAMDFULLNAME = amdPovA1?.name ?? "";
  data.CLIENTSECONDALTERNATEAMDFULLNAME = amdPovA2?.name ?? "";
  data.CLIENTFIRSTALTERNATEAMDAddress = formatAddress(amdPovA1);
  data.CLIENTSECONDALTERNATEAMDAddress = formatAddress(amdPovA2);
  data.CLIENTFIRSTALTERNATEAMDRelationship = cleanRelationshipPhrase(phraseForPov(amdPovA1, povClient));
  data.CLIENTSECONDALTERNATEAMDRelationship = cleanRelationshipPhrase(phraseForPov(amdPovA2, povClient));

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
  const poa2P = byId(intake.people, poaRole2.primary);
  const poa2A1 = byId(intake.people, poaRole2.alternate1);
  const poa2A2 = byId(intake.people, poaRole2.alternate2);

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

  const amd2P = byId(intake.people, amdRole2.primary);
  const amd2A1 = byId(intake.people, amdRole2.alternate1);
  const amd2A2 = byId(intake.people, amdRole2.alternate2);

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

  // Final disposition agents (appointment to control disposition of remains)
  const fd1Ranks = finalDispositionRanksForClient(intake, 1);
  const fd2Ranks = finalDispositionRanksForClient(intake, 2);

  const fd1Primary = byId(intake.people, fd1Ranks?.[0]?.[0]);
  const fd2Primary = byId(intake.people, fd2Ranks?.[0]?.[0]);

  data.Client1FinalDispositionPrimaryFullName = fd1Primary?.name ?? "";
  data.Client1FinalDispositionPrimaryEmail = fd1Primary?.email ?? "";
  data.Client1FinalDispositionPrimaryPhone = fd1Primary?.phone ?? "";
  data.Client1FinalDispositionPrimaryStreetAddress = fd1Primary?.addressStreet ?? "";
  data.Client1FinalDispositionPrimaryCity = fd1Primary?.addressCity ?? "";
  data.Client1FinalDispositionPrimaryState = fd1Primary?.addressState ?? "";
  data.Client1FinalDispositionPrimaryZip = fd1Primary?.addressZip ?? "";

  data.Client2FinalDispositionPrimaryFullName = fd2Primary?.name ?? "";
  data.Client2FinalDispositionPrimaryEmail = fd2Primary?.email ?? "";
  data.Client2FinalDispositionPrimaryPhone = fd2Primary?.phone ?? "";
  data.Client2FinalDispositionPrimaryStreetAddress = fd2Primary?.addressStreet ?? "";
  data.Client2FinalDispositionPrimaryCity = fd2Primary?.addressCity ?? "";
  data.Client2FinalDispositionPrimaryState = fd2Primary?.addressState ?? "";
  data.Client2FinalDispositionPrimaryZip = fd2Primary?.addressZip ?? "";

  const fmtAlt = (p?: Person) => {
    if (!p) return "";
    const bits = [p.name, p.email, formatAddress(p)].filter((x) => (x || "").trim());
    return bits.join(" — ");
  };

  const fmtSuccessors = (ranks: string[][]) => {
    const out: string[] = [];
    for (let i = 1; i < (ranks || []).length; i++) {
      const ids = (ranks[i] || []).filter(Boolean);
      if (!ids.length) continue;
      const peopleText = ids.map((id) => fmtAlt(byId(intake.people, id))).filter(Boolean).join("; ");
      if (!peopleText) continue;
      out.push(`Successor ${i}: ${peopleText}`);
    }
    return out.join("\n");
  };

  data.Client1FinalDispositionAlternatesText = fmtSuccessors(fd1Ranks || []);
  data.Client2FinalDispositionAlternatesText = fmtSuccessors(fd2Ranks || []);

  return data;
}
