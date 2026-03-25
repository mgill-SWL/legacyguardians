export type PacketDocKey =
  | "jointTrust"
  | "declarationOfTrust"
  | "certificationOfTrust"
  | "assignmentOfPersonalProperty"
  | "willClient1"
  | "willClient2";

export const binderPlan = [
  { key: "jointTrust", label: "Joint Trust", zipName: "01_Joint_Trust.docx" },
  { key: "willClient1", label: "Last Will (Client 1)", zipName: "02_Last_Will_Client1.docx" },
  { key: "willClient2", label: "Last Will (Client 2)", zipName: "03_Last_Will_Client2.docx" },
  // TODO: AMD, Burial POA, GDPOA, etc.
  { key: "certificationOfTrust", label: "Certification of Trust", zipName: "06_Certification_of_Trust.docx" },
  { key: "assignmentOfPersonalProperty", label: "Assignment of Personal Property", zipName: "07_Assignment_of_Personal_Property.docx" },
  { key: "declarationOfTrust", label: "Declaration of Trust", zipName: "08_Declaration_of_Trust.docx" },
] as const;
