/**
 * Locates invisible signing anchors in a PDF so Documenso signature/date
 * fields can be placed automatically, wherever the anchors ended up after
 * the attorney's edits.
 *
 * Templates embed anchors as tiny white text (e.g. "@@SIG1@@") at each
 * signature spot — see tools/ra-template/buildTemplate.js. Any DOCX template
 * with these anchors gets automatic field placement for free.
 */

export const SIGNING_ANCHORS = {
  "@@SIG1@@": { signer: 1, kind: "SIGNATURE" },
  "@@DATE1@@": { signer: 1, kind: "DATE" },
  "@@SIG2@@": { signer: 2, kind: "SIGNATURE" },
  "@@DATE2@@": { signer: 2, kind: "DATE" },
} as const;

export type AnchorHit = {
  anchor: keyof typeof SIGNING_ANCHORS;
  signer: 1 | 2;
  kind: "SIGNATURE" | "DATE";
  /** 1-based page number */
  page: number;
  /** Percentage (0-100) from the page's left edge */
  positionX: number;
  /** Percentage (0-100) from the page's top edge (anchor text baseline) */
  positionY: number;
};

export async function findSigningAnchors(pdf: Buffer): Promise<AnchorHit[]> {
  // Legacy build avoids the worker requirement in serverless Node.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  const hits: AnchorHit[] = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      for (const item of content.items) {
        if (!("str" in item) || typeof item.str !== "string") continue;
        for (const anchor of Object.keys(SIGNING_ANCHORS) as Array<keyof typeof SIGNING_ANCHORS>) {
          if (!item.str.includes(anchor)) continue;
          // transform[4]/transform[5] are the x/y of the text origin in PDF
          // user space (bottom-left origin); convert to top-left percentages.
          const x = item.transform[4];
          const y = item.transform[5];
          const meta = SIGNING_ANCHORS[anchor];
          hits.push({
            anchor,
            signer: meta.signer,
            kind: meta.kind,
            page: pageNum,
            positionX: Math.max(0, Math.min(100, (x / viewport.width) * 100)),
            positionY: Math.max(0, Math.min(100, ((viewport.height - y) / viewport.height) * 100)),
          });
        }
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return hits;
}

/** Default field sizes as page percentages (US Letter). */
const FIELD_SIZES = {
  SIGNATURE: { width: 28, height: 4.5 },
  DATE: { width: 16, height: 3 },
} as const;

export type PlacedField = {
  type: "SIGNATURE" | "DATE";
  signer: 1 | 2;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

/**
 * Converts anchor hits into field rectangles. The anchor sits at the start of
 * the signature line, so the field is placed just above it (signing happens
 * above the underline), nudged fully inside the page bounds.
 */
export function fieldsFromAnchors(hits: AnchorHit[]): PlacedField[] {
  return hits.map((hit) => {
    const size = FIELD_SIZES[hit.kind];
    const top = Math.max(0, Math.min(100 - size.height, hit.positionY - size.height));
    const left = Math.max(0, Math.min(100 - size.width, hit.positionX));
    return {
      type: hit.kind,
      signer: hit.signer,
      page: hit.page,
      positionX: left,
      positionY: top,
      width: size.width,
      height: size.height,
    };
  });
}
