/**
 * Builds the tokenized General / Hourly (minimum-fee) Representation Agreement.
 * Suitable for litigation, elder law, deeds, and other non-flat-fee matters.
 *
 * Output: templates/ra/RA-General-Hourly-tokenized.docx
 *
 * Tokens (app [[Token]] delimiters):
 *   [[ClientFullName]] [[ClientEmail]] [[Date]] [[LeadAttorney]]
 *   [[MatterScope]] [[RetainerAmount]]
 * Signing anchors (single signer = the client): @@SIG1@@ / @@DATE1@@
 *
 * Source: Speedwell "RA - Adv Min Fee" (Lawmatics), punched up + a
 * replenishing trust-retainer clause added. Regenerate: node buildGeneralRA.js
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, BorderStyle, WidthType, ShadingType,
  PageBreak, PageNumber,
} = require("docx");

const FONT = "Times New Roman";
const BODY = 22; // 11pt
const CONTENT_WIDTH = 9360;

const border = { style: BorderStyle.SINGLE, size: 4, color: "444444" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: BODY, ...opts });
}
function body(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, children: [run(text)] });
}
function centeredTitle(text, size = 28, spaceBefore = 120) {
  return new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, spacing: { before: spaceBefore, after: 200 }, children: [run(text, { bold: true, size })] });
}
function heading(text) {
  return new Paragraph({ keepNext: true, numbering: { reference: "ra-sec", level: 0 }, spacing: { before: 200, after: 120 }, children: [run(text, { bold: true })] });
}
// Invisible signing anchor (tiny white text) located in the exported PDF.
function anchorRun(anchor) {
  return new TextRun({ text: anchor, font: FONT, size: 2, color: "FFFFFF" });
}
function sigLine(anchor) {
  return new Paragraph({ keepNext: true, spacing: { before: 360, after: 40 }, children: [...(anchor ? [anchorRun(anchor)] : []), run("_________________________________________")] });
}
function plain(text, { last = false, bold = false } = {}) {
  return new Paragraph({ keepNext: !last, spacing: { after: 40 }, children: [run(text, { bold })] });
}
function dateLine(anchor, { last = false } = {}) {
  return new Paragraph({ keepNext: !last, spacing: { after: 40 }, children: [run("Date: "), ...(anchor ? [anchorRun(anchor)] : []), run("_____________________")] });
}

// Client signature block (single signer). withDate adds a dated line.
function clientSig({ withDate = true, last = false } = {}) {
  return [
    sigLine("@@SIG1@@"),
    plain("Client: [[ClientFullName]]", { last: !withDate && last }),
    ...(withDate ? [dateLine("@@DATE1@@", { last })] : []),
  ];
}

function cell(children, width, shadeFill) {
  return new TableCell({
    borders,
    margins: cellMargins,
    width: { size: width, type: WidthType.DXA },
    shading: shadeFill ? { fill: shadeFill, type: ShadingType.CLEAR } : undefined,
    children,
  });
}

const RATE_COLS = [6360, 3000];
const rateRow = (label, amount, head = false) =>
  new TableRow({
    children: [
      cell([new Paragraph({ children: [run(label, { bold: head })] })], RATE_COLS[0], head ? "2E74B5" : undefined),
      cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(amount, { bold: head })] })], RATE_COLS[1], head ? "2E74B5" : undefined),
    ],
  });

const children = [
  centeredTitle("Representation Agreement (“Agreement”)"),

  heading("The Parties and Scope of Representation"),
  body(
    "On this [[Date]], Speedwell Law, PLLC (“Law Firm”) agrees to represent [[ClientFullName]] (“Client”) in the following matter:"
  ),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, indent: { left: 360 }, children: [run("[[MatterScope]]")] }),
  body(
    "The Law Firm and Client are together referred to as the “Parties.” Work by the Law Firm outside of this scope may be performed if agreed upon by the Parties."
  ),

  heading("Fee Agreement"),
  body(
    "The Law Firm will represent the Client for a fee. Legal work will be billed at an hourly rate (in SIX (6) minute increments) according to the rates on Exhibit A and may be agreed to orally or in writing. In general, legal work includes but is not limited to: review and analysis; research; correspondence; conferences; preparation and execution of legal documents. Necessary travel will be billed at half the attorney’s hourly rate. Deeds shall be prepared and recorded for the fees indicated on Exhibit A."
  ),
  body(
    "Paralegal/administrative matters associated with legal work will be charged at the hourly rates indicated on Exhibit A. Paralegal/administrative work can include: scanning and filing documents, filing documents with appropriate agencies, preparing mailings, copies, faxes, and necessary travel. The Law Firm will do its best to categorize each separately."
  ),
  body(
    "The Client agrees to bear the cost of any administrative or court costs (“Admin Fees”). Administrative costs can include, but are not limited to, conference room reservation fees, external deed preparation service fees, witness fees, mailing costs, filing fees, process server costs, court reporter fees, notice publication fees, and other costs that may arise. If the representation lasts longer than 90 days, the Client will incur a $50 per month administrative cost, waivable at the sole discretion of Law Firm. Meetings cancelled by Client less than 24 hours in advance shall be subject to a $100 cancellation fee."
  ),

  heading("Retainer"),
  body(
    "Upon execution of this Agreement, Client shall deposit a retainer of $[[RetainerAmount]] with the Law Firm. The retainer is an advance against fees and costs and will be held in the Law Firm’s trust (IOLTA) account. The Law Firm will apply the retainer against invoices as fees are earned and costs are incurred, withdrawing earned amounts from trust in accordance with applicable rules. The retainer is not a flat fee and does not cap the fees that may be incurred; Client remains responsible for all fees and costs under this Agreement. Client agrees to replenish the retainer upon the Law Firm’s request so that it is restored toward the initial amount. Any unearned portion of the retainer remaining at the conclusion of the representation will be returned to the Client promptly."
  ),

  heading("Payments, Invoices, and Late Fees"),
  body(
    "Client promises to pay the Law Firm promptly upon being invoiced for services. Invoices will be delivered either by email or mail when the accumulated hourly fee services exceed $1,000; when convenient to Law Firm; or upon client request. If Client wishes to pay by credit card, a 2% charge may be added to cover credit card and processing fees at Law Firm’s discretion. If Client has a card on file with the Law Firm, an invoice shall be charged against the card on file not less than one business day after the invoice is sent to the Client, unless an objection is received from the Client. If the Client objects to a fee, it shall still be collectible, but the Law Firm shall work with the Client to clarify the reason for the charge and escalate the matter within the Law Firm appropriately. Upon conclusion of the representation, any unearned funds held by the Law Firm will be returned to the Client promptly. Late fees shall accrue at a rate of 6% per annum if not paid within 30 days of Client being invoiced for such work."
  ),

  heading("Representations"),
  body(
    "No guarantees have been or can be made as to the outcome of this or any matter. The Law Firm will work hard to serve the best interests of the Client. Client agrees to be truthful and cooperative with the Law Firm, providing information, responding to emails, and responding to phone calls in a timely manner. Any material misrepresentations or unwillingness to cooperate with the Law Firm’s direction or guidance is grounds for the Law Firm to withdraw from representation."
  ),

  heading("Notice and Communication"),
  body(
    "Client agrees to receive primary notice of legal proceedings, updates, correspondence, bills, and other files via electronic mail. The Law Firm and Client may correspond via phone, facsimile, or other means as the need and convenience requires. Client’s email address for notice purposes is: [[ClientEmail]]"
  ),

  heading("Use of Technology and Artificial Intelligence"),
  body(
    "The Law Firm uses modern technology, including cloud-based systems, document automation, and artificial intelligence-assisted tools, to enhance efficiency, accuracy, and client service, subject to attorney supervision and the Law Firm’s ethical obligations, including the duty of confidentiality. All final work product is reviewed by a licensed attorney. By entering into this Agreement, the Client consents to the Law Firm’s use of such technologies in the course of the representation."
  ),

  heading("Closing or Terminating Representation"),
  body(
    "Either Client or Law Firm may end the representation at any time for any reason. However, the Law Firm has certain ongoing ethical obligations to the Client, and the Law Firm will comply with all ethical obligations as deemed by the Court or otherwise. Should Client and Law Firm mutually end the representation before work has been completed, Client shall bear the full cost of services and reimbursable expenses already performed at the firm’s hourly rate, and the Law Firm shall remit a detailed invoice to the Client prior to taking any fees held in trust. If the Law Firm ends representation unilaterally, Client shall pay for services rendered at the Law Firm’s present hourly billing rate indicated on Exhibit A, including services ethically required to be provided and client file reproduction services. Any Client funds in the Law Firm’s possession may be applied to satisfy the fee obligation, with any unearned balance returned to the Client."
  ),

  heading("Electronic Storage and Physical Files"),
  body(
    "Client is hereby notified and understands that the physical copy of their file shall be destroyed THIRTY DAYS (30 days) after the close of representation. All original documents will be returned to the Client at the close of representation. Client may request a physical copy of their file (not to include attorney’s notes) any time before the 30-day expiration date following the close of representation, for which Client agrees to bear the cost of reproduction and mailing. Client may request an electronic copy of their file (not to include attorney’s notes) at any time after the close of representation up to three years from the conclusion of the representation. Client consents to the Law Firm’s use of Dropbox cloud services and consents to electronic storage of Client’s file thereon."
  ),

  heading("Disputes Concerning the Agreement"),
  body(
    "The Client and Law Firm agree that any suit brought arising out of this representation must be brought in the City of Alexandria Court system in the Commonwealth of Virginia. The Client and Law Firm agree also to in good faith try to resolve any disputes prior to suit being brought. The Client agrees, to the fullest extent permitted by law, to limit the liability of the Law Firm to the Client for any and all claims, losses, costs, expenses, or damages of any nature whatsoever, including attorney and expert-witness fees and costs, from any cause or causes, so that the total aggregate liability of Speedwell Law, PLLC to the Client shall not exceed 20% of the paid fee of this contract. It is intended that this limitation shall apply to any and all liability or causes of action however alleged or arising, unless otherwise specifically prohibited by law."
  ),

  body("I AGREE TO THIS REPRESENTATION AGREEMENT AND ACKNOWLEDGE IT IS A MUTUAL PROMISE OF PERFORMANCE ACCORDING TO THE TERMS OF THIS CONTRACT:"),

  new Paragraph({ keepNext: true, spacing: { before: 200, after: 40 }, children: [run("LAW FIRM:", { bold: true })] }),
  sigLine(),
  plain("[[LeadAttorney]]"),
  plain("Speedwell Law, PLLC"),
  plain("2000 Duke Street, Suite 300"),
  plain("Alexandria, VA 22314", { last: true }),

  new Paragraph({ keepNext: true, spacing: { before: 240, after: 40 }, children: [run("CLIENT:", { bold: true })] }),
  ...clientSig({ withDate: true, last: true }),

  new Paragraph({ children: [new PageBreak()] }),

  centeredTitle("LIMITED POWER OF ATTORNEY", 24),
  body(
    "This representation may require the preparation and execution of Deeds and other conveyance instruments that must be recorded. I grant to Speedwell Law a limited power of attorney to correct typographic errors and amend formatting on conveyance instruments in order to facilitate recordation of the same."
  ),
  ...clientSig({ withDate: true, last: true }),

  new Paragraph({ children: [new PageBreak()] }),

  centeredTitle("EXHIBIT A", 24),
  centeredTitle("Hourly Rates and Services", 24),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run("2026 Hourly Rates", { bold: true })] }),
  new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: RATE_COLS,
    rows: [
      rateRow("Senior Attorney", "$450"),
      rateRow("Associate", "$350"),
      rateRow("Paralegal", "$185"),
      rateRow("Legal Assistant", "$125"),
    ],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 200 }, children: [run("(Only valid for 2026)")] }),

  new Paragraph({ spacing: { after: 100 }, children: [run("Services", { bold: true })] }),
  new Paragraph({ spacing: { after: 60 }, children: [run("Conveyance and Miscellaneous Instruments", { bold: true })] }),
  new Paragraph({ numbering: { reference: "svc", level: 0 }, children: [run("Virginia Deeds: $375 flat fee (includes cost to record)")] }),
  new Paragraph({ numbering: { reference: "svc", level: 0 }, children: [run("Deeds in any other jurisdiction: $200 flat fee, plus cost of external deed preparation service (external vendor invoice is forwarded to client and clients must pay directly)")] }),
  new Paragraph({ numbering: { reference: "svc", level: 0 }, children: [run("Transfer on Death (TOD) Deed: $537")] }),
  new Paragraph({ numbering: { reference: "svc", level: 0 }, children: [run("Assignments of LLC/Business Interest: $100")] }),
  new Paragraph({ numbering: { reference: "svc", level: 0 }, children: [run("Attorney Opinion Letter: $150")] }),

  ...clientSig({ withDate: false, last: true }),

  new Paragraph({ children: [new PageBreak()] }),

  centeredTitle("EXHIBIT B", 24),
  centeredTitle("Client Expectations Agreement", 24),
  body("I understand that meetings canceled less than 1 business day in advance carry a $100 cancellation fee."),
  ...clientSig({ withDate: false, last: true }),
];

const letterhead = fs.readFileSync(path.join(__dirname, "letterhead.jpg"));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  numbering: {
    config: [
      { reference: "ra-sec", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
      { reference: "svc", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        titlePage: true,
      },
      headers: {
        first: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: "jpg",
                  data: letterhead,
                  transformation: { width: 87, height: 87 },
                  altText: { title: "Speedwell Law", description: "Speedwell Law, PLLC logo", name: "SpeedwellLogo" },
                }),
              ],
            }),
          ],
        }),
        default: new Header({ children: [new Paragraph({ children: [] })] }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ font: FONT, size: 18, children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] })],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const outPath = path.resolve(__dirname, "..", "..", "templates", "ra", "RA-General-Hourly-tokenized.docx");
Packer.toBuffer(doc).then((buffer) => {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log(`Written: ${outPath} (${buffer.length} bytes)`);
});
