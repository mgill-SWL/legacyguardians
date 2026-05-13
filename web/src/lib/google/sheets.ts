import { getGoogleAccessToken } from "@/lib/google/google";

export type GoogleSheetsValuesBatchGetResult = {
  spreadsheetId: string;
  valueRanges: { range: string; majorDimension?: string; values?: any[][] }[];
};

export async function googleSheetsValuesBatchGet({
  googleEmail,
  spreadsheetId,
  ranges,
  valueRenderOption = "UNFORMATTED_VALUE",
}: {
  googleEmail: string;
  spreadsheetId: string;
  ranges: string[];
  valueRenderOption?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA";
}) {
  const token = await getGoogleAccessToken(googleEmail);
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
  for (const r of ranges) url.searchParams.append("ranges", r);
  url.searchParams.set("valueRenderOption", valueRenderOption);
  // For UNFORMATTED_VALUE, dates come back as serial numbers. If the sheet has formatted strings, we still handle them.
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const json = (await res.json().catch(() => null)) as GoogleSheetsValuesBatchGetResult | any;
  if (!res.ok) {
    const msg = json?.error?.message || "Sheets batchGet failed";
    throw new Error(msg);
  }

  return json as GoogleSheetsValuesBatchGetResult;
}

