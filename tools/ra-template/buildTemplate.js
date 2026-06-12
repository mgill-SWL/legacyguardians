/**
 * Builds the tokenized Representation Agreement (Couple) template for the app.
 *
 * Output: templates/ra/RA-EP-Couple-tokenized.docx — upload it on the
 * Document Templates admin page (kind: REPRESENTATION_AGREEMENT).
 *
 * Tokens use the app's [[Token]] delimiters and must match buildMergeData in
 * web/src/app/api/crm/leads/[leadId]/representation-agreements/route.ts:
 *   [[ClientFullName]] [[SpouseFullName]] [[ClientEmail]] [[LeadAttorney]]
 *   [[Date]] [[TotalFee]] [[PaymentTerm]]
 *   [[#QuoteLineItems]] [[label]] [[amount]] [[summary]] [[/QuoteLineItems]]
 *
 * Language source: Lawmatics "EP-Couple-Proposal and RA" (copied 2026-06-12).
 * Regenerate with: node buildTemplate.js
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, AlignmentType, LevelFormat, ExternalHyperlink, BorderStyle,
  WidthType, ShadingType, PageBreak, Footer, PageNumber,
} = require("docx");

const FONT = "Times New Roman";
const BODY_SIZE = 22; // 11pt
const CONTENT_WIDTH = 9360; // US Letter, 1" margins

const border = { style: BorderStyle.SINGLE, size: 4, color: "444444" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: BODY_SIZE, ...opts });
}

function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [run(text, opts.run || {})],
    ...opts.para,
  });
}

function centeredTitle(text, size = 28, { spaceBefore = 120 } = {}) {
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: spaceBefore, after: 240 },
    children: [run(text, { bold: true, size })],
  });
}

function numberedHeading(text) {
  return new Paragraph({
    keepNext: true,
    numbering: { reference: "ra-sections", level: 0 },
    spacing: { before: 200, after: 120 },
    children: [run(text, { bold: true })],
  });
}

// keepNext chains the paragraphs of a signature block together so a block
// can never split across a page break (no orphaned lines or date rows).
function sigLine() {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 480, after: 40 },
    children: [run("_________________________________")],
  });
}

function sigLabel(text, { last = false } = {}) {
  return new Paragraph({ keepNext: !last, spacing: { after: 40 }, children: [run(text)] });
}

function coupleSignatureBlock() {
  return [
    sigLine(),
    sigLabel("CLIENT SPOUSE 1: [[ClientFullName]]"),
    sigLabel("Date: _________________________"),
    sigLine(),
    sigLabel("CLIENT SPOUSE 2: [[SpouseFullName]]"),
    sigLabel("Date: _________________________", { last: true }),
  ];
}

function cell(children, opts = {}) {
  return new TableCell({
    borders,
    margins: cellMargins,
    width: opts.width,
    shading: opts.shading,
    children,
  });
}

// ---------------------------------------------------------------------------
// Page 1: Customized Estate Planning Proposal
// ---------------------------------------------------------------------------

const FEE_COLS = [3100, 1500, 4760];

const feeTable = new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: FEE_COLS,
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Service / Feature", { bold: true, color: "FFFFFF" })] })], { width: { size: FEE_COLS[0], type: WidthType.DXA }, shading: { fill: "2E74B5", type: ShadingType.CLEAR } }),
        cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Fee", { bold: true, color: "FFFFFF" })] })], { width: { size: FEE_COLS[1], type: WidthType.DXA }, shading: { fill: "2E74B5", type: ShadingType.CLEAR } }),
        cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Description", { bold: true, color: "FFFFFF" })] })], { width: { size: FEE_COLS[2], type: WidthType.DXA }, shading: { fill: "2E74B5", type: ShadingType.CLEAR } }),
      ],
    }),
    // Loop row: docxtemplater duplicates this row once per quote line.
    new TableRow({
      children: [
        cell([new Paragraph({ children: [run("[[#QuoteLineItems]][[label]]")] })], { width: { size: FEE_COLS[0], type: WidthType.DXA } }),
        cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("[[amount]]")] })], { width: { size: FEE_COLS[1], type: WidthType.DXA } }),
        cell([new Paragraph({ children: [run("[[summary]][[/QuoteLineItems]]")] })], { width: { size: FEE_COLS[2], type: WidthType.DXA } }),
      ],
    }),
    new TableRow({
      children: [
        cell([new Paragraph({ children: [run("Total Flat Fee", { bold: true })] })], { width: { size: FEE_COLS[0], type: WidthType.DXA }, shading: { fill: "EEF3F9", type: ShadingType.CLEAR } }),
        cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("[[TotalFee]]", { bold: true })] })], { width: { size: FEE_COLS[1], type: WidthType.DXA }, shading: { fill: "EEF3F9", type: ShadingType.CLEAR } }),
        cell([new Paragraph({ children: [run("[[PaymentTerm]]")] })], { width: { size: FEE_COLS[2], type: WidthType.DXA }, shading: { fill: "EEF3F9", type: ShadingType.CLEAR } }),
      ],
    }),
  ],
});

const proposalPage = [
  centeredTitle("Your Customized Estate Planning Proposal"),
  body(
    "The following proposal outlines your selected attorney tier, service features, and courtesy adjustments for [[ClientFullName]] and [[SpouseFullName]]. These selections form the basis of your flat-fee estate planning engagement with Speedwell Law. Only the services you selected appear below. You may ask your intake specialist to revise and resend according to your desires. If you have scheduled a design meeting, this Representation Agreement must be signed within 24 hours of the discovery call to keep your meeting on our calendar. In addition, please accept the meeting invitation to confirm the meeting. If we do not receive a signed Representation Agreement and are unable to reach you, the meeting may be canceled so the time can be released."
  ),
  // Blank line between the intro and the fee table (mirrors the hard return
  // used in the Lawmatics version to keep the table from crowding the text).
  new Paragraph({ spacing: { after: 0 }, children: [] }),
  feeTable,
  new Paragraph({ spacing: { before: 200, after: 160 }, alignment: AlignmentType.JUSTIFIED, children: [
    run("For your convenience, and if payment was not made during the discovery call, you may use the following link to pay in full: "),
    new ExternalHyperlink({
      children: [new TextRun({ text: "https://secure.lawpay.com/pages/speedwelllaw/trust", font: FONT, size: BODY_SIZE, style: "Hyperlink" })],
      link: "https://secure.lawpay.com/pages/speedwelllaw/trust",
    }),
  ]}),
  body(
    "Payment is due within twenty-four (24) hours of scheduling the Design Meeting and returning this Representation Agreement within the same timeframe to keep your meeting reserved, unless a courtesy adjustment has been discussed and agreed upon. Please enter the quoted fee in the “payment amount” field and confirm accuracy before submitting. A receipt will be provided upon payment."
  ),
  body(
    "Your deposit will be placed in our Law Firm’s IOLTA account, where any interest earned supports the Legal Services Corporation of Virginia in providing civil legal services to those in need. These funds are kept separate from our operating account, meaning your deposit remains secure and refundable until earned. Thank you in advance for completing payment promptly."
  ),
  body(
    "I approve this customized proposal and authorize Speedwell Law to proceed with preparation of my estate plan as outlined above."
  ),
  ...coupleSignatureBlock(),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------------------------------------------------------------------------
// Representation Agreement
// ---------------------------------------------------------------------------

const agreement = [
  centeredTitle("Representation Agreement (“Agreement”)"),

  numberedHeading("The Parties and Scope of Representation"),
  body(
    "On this [[Date]], Speedwell Law, PLLC (“Law Firm”) agrees to represent [[ClientFullName]] and [[SpouseFullName]] (Collectively “Client”) (together, the “Parties”), with their estate planning matter. Work by the Law Firm outside of this scope may be performed if agreed upon by the Parties."
  ),

  numberedHeading("Fee Agreement"),
  body(
    "The Law Firm will represent the Client for a fee, the minimum being a flat fee as indicated on the above customized Estate Planning Proposal, which shall include a one-hour initial consultation, a sixty to ninety minute Document Tour, a one-hour signing ceremony, all correspondence, drafting and finalizing an estate plan."
  ),
  body(
    "While it is not expected, but if needed, additional legal work will be billed at an hourly rate (in SIX (6) minute increments) according to the rates on Exhibit A, and may be agreed to orally or in writing. Legal work includes but is not limited to: Review and analysis; research; correspondence; conferences; preparation and execution of legal documents. Necessary travel will be billed at half the attorney’s hourly rate. Deeds shall be prepared and recorded for the fees indicated on Exhibit A."
  ),
  body(
    "Paralegal/administrative matters associated with additional legal work will be charged at the hourly rates indicated on Exhibit A. Paralegal/administrative work can include: scanning and filing documents, filing documents with appropriate agencies, preparing mailings, copies, faxes, and necessary travel. Conferences between employees shall not incur secondary charges and shall be billed only under one timekeeper, but the timekeeper with the higher rate shall apply."
  ),
  body(
    "The client agrees to bear the cost of any administrative or court costs (“Admin Fees”). Administrative costs can include, but are not limited to, conference room reservation fees, external deed preparation service fees, witness fees, mailing costs, filing fees, process server costs, court reporter fees, notice publication fees, and other costs that may arise. If the representation lasts longer than 90 days, the Client will incur a $50 per month administrative cost, waivable at the sole discretion of Law Firm. Meetings cancelled by Client less than 24 hours in advance shall be subject to a $100 cancellation fee."
  ),

  numberedHeading("Payments, Invoices, and Late Fees"),
  body(
    "Client promises to pay the Law Firm upon being invoiced for services. Invoices will be delivered either by email or mail when the hourly services accumulated fee exceeds $1,000; when convenient to Law Firm; or upon client request. If Client wishes to pay by credit card, a 2% charge may be added to cover credit card and processing fees at Law Firm’s discretion. Upon conclusion of representation, any unearned funds will be returned to the Client promptly. Late fees shall accrue at a rate of 6% per annum if not paid within 30 days of Client being invoiced for such work. Any advanced legal fees in the Law Firm’s possession are considered earned in full at the conclusion of the Document Tour. If client reschedules the document tour, one-half the fee shall be earned as of the original scheduled date for the document tour, but no late fee shall accrue. Fee deposits that are made to our Law Firm’s IOLTA account earns interest which benefits the Legal Services Corporation of Virginia to support the organization’s civil legal services to people living in poverty in Virginia. IOLTA funds are physically segregated from our operating account."
  ),

  numberedHeading("Ongoing Maintenance and Separate Membership Services"),
  body(
    "The scope of representation described in this Agreement is limited to the preparation, review, and execution of the Client’s estate planning documents. Ongoing maintenance, trust funding oversight, beneficiary coordination, periodic review, and post-signing support are not included in this Agreement unless expressly stated herein. Speedwell Law offers a separate ongoing maintenance program known as the Probate Avoidance Club (“PAC”), which is governed by a separate membership agreement. Participation in PAC is optional in some cases and required in others, including as a condition of eligibility for certain guarantees and for Speedwell Law to serve as fiduciary, as described below. No services provided under PAC are included in the fees described in this Agreement unless expressly agreed to in writing."
  ),

  numberedHeading("Guarantees/Representations"),
  body(
    "Except as expressly stated herein, no guarantees have been or can be made as to the outcome of this or any matter. The Client may request a full refund of all fees paid under this Agreement within ten (10) calendar days of signing, if the Client determines that the Law Firm has not provided services in a manner the Client finds helpful or aligned with their objectives. To request a refund, the Client must provide written notice within the 10-day period. Upon such request, this Agreement will terminate and any unearned fees will be refunded. After the 10-day period has expired, all fees are non-refundable, and the representation will continue pursuant to the terms of this Agreement. Refunds under this provision apply only if requested before substantial completion of the design phase and prior to delivery of draft estate planning documents. This satisfaction guarantee applies only to the estate planning portion of the representation and does not extend to future changes, trust funding, asset coordination, or estate administration. The Law Firm will work hard to serve the best interests of the Client. Client agrees to be truthful and cooperative with the Law Firm, providing information, responding to emails, and responding to phone calls in a timely manner. Any material misrepresentations or unwillingness to cooperate with the Law Firm’s direction or guidance is grounds for the Law Firm to withdraw from representation. Any firm-offered estate settlement or administration guarantee, including any six-month estate settlement guarantee, is not part of this Agreement and does not apply automatically. Such guarantees apply only in qualifying cases and only when expressly offered in writing by the Law Firm. Eligibility for any estate settlement guarantee is conditioned upon, among other requirements, the Client’s participation in the Fiduciary and Continuity Program, the Law Firm’s service as fiduciary, and the Client’s ongoing cooperation, including the timely provision of requested information. Failure to meet these conditions shall void any applicable guarantee."
  ),

  numberedHeading("Notice and Communication"),
  body(
    "Client agrees to receive primary notice of legal proceedings, updates, correspondence, bills, and other files via electronic mail. The Law Firm and Client may correspond via phone, facsimile, or other means as the need and convenience requires. Client’s email addresses for notice purposes are: [[ClientEmail]]"
  ),

  numberedHeading("Use of Technology and Artificial Intelligence"),
  body(
    "The Client acknowledges that the Law Firm utilizes modern technology tools, including cloud-based systems, document automation software, and artificial intelligence-assisted technologies, to enhance efficiency, accuracy, and client service. These tools may be used in connection with document drafting, internal workflows, communications, and data organization. All use of such technology is subject to the Law Firm’s professional judgment, attorney supervision, and applicable ethical obligations, including the duty of confidentiality. The Law Firm takes reasonable steps to ensure that any third-party technology providers maintain appropriate data security standards. By entering into this Agreement, the Client consents to the Law Firm’s use of such technologies in the course of representation. The Client understands that artificial intelligence tools are used as assistive technologies and not as a substitute for attorney judgment. All final work product is reviewed by a licensed attorney."
  ),

  numberedHeading("Closing or Terminating Representation"),
  body(
    "Either Client or Law Firm may end the representation at any time for any reason. However, the Law Firm has certain ongoing ethical obligations to the Client and as such, the Law Firm will comply with any and all ethical obligations for the Client as deemed by the Court or otherwise. Should Client and Law Firm mutually end representation before work has been completed, Client shall bear the full cost of services already performed for Client at the agreed upon price. If the Law Firm ends representation unilaterally, any Flat Fee billing arrangement may be voided by Law Firm and Client shall pay for services, including file reproduction services, rendered at the Law Firm’s present hourly billing rate. The representation shall be considered concluded 30 days from the Signing Ceremony. Law Firm may unilaterally terminate the representation if the client has no contact with the Law Firm for a period in excess of SIX (6) MONTHS."
  ),

  numberedHeading("Electronic Storage and Physical Files"),
  body(
    "Client is hereby notified and understands that the physical copy of their file shall be destroyed THIRTY DAYS (30 days) after the close of representation. All original documents will be returned to the client at the close of representation. Client may request a physical copy of their file (not to include attorney’s notes) any time before the 30-day expiration date following the close of representation, for which Client agrees to bear the cost of reproduction and mailing of Client’s file to Client. Client may request an electronic copy of their file (not to include attorney’s notes) at any time after the close of representation up to three years from the conclusion of the representation. Client consents to the Law Firm’s use of Dropbox cloud services and consents to electronic storage of Client’s file thereon. Client also consents to the Law Firm’s use of secure third-party software and technology platforms, including artificial intelligence-assisted tools, in connection with the storage, processing, and management of Client information."
  ),

  numberedHeading("Disputes Concerning the Agreement"),
  body(
    "The Client and Law Firm agree that any suit brought arising out of this representation must be brought in the City of Alexandria Court system in the Commonwealth of Virginia. The Client and Law Firm agree also to in good faith try to resolve any disputes prior to suit being brought. The Client agrees, to the fullest extent permitted by law, to limit the liability of Law Firm to the Client for any and all claims, losses, costs, expenses, or damages of any nature whatsoever, including attorney and expert-witness fees and costs, from any cause or causes, so that the total aggregate liability of Speedwell Law, PLLC to the Client shall not exceed 20% of the paid fee of this contract. It is intended that this limitation shall apply to any and all liability or causes of action however alleged or arising, unless otherwise specifically prohibited by law."
  ),

  body(
    "I AGREE TO THIS REPRESENTATION AGREEMENT AND ACKNOWLEDGE IT IS A MUTUAL PROMISE OF PERFORMANCE ACCORDING TO THE TERMS OF THIS CONTRACT:",
    { run: { bold: true } }
  ),

  new Paragraph({ keepNext: true, spacing: { before: 240, after: 40 }, children: [run("LAW FIRM:", { bold: true })] }),
  sigLine(),
  sigLabel("[[LeadAttorney]]"),
  sigLabel("Speedwell Law, PLLC"),
  sigLabel("2000 Duke Street, Suite 300"),
  sigLabel("Alexandria, VA 22314"),
  sigLabel("Date: [[Date]]", { last: true }),

  new Paragraph({ keepNext: true, spacing: { before: 240, after: 40 }, children: [run("CLIENT:", { bold: true })] }),
  ...coupleSignatureBlock(),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------------------------------------------------------------------------
// Waiver, Limited POA, Exhibits
// ---------------------------------------------------------------------------

const waiverAndPoa = [
  centeredTitle("WAIVER OF POTENTIAL CONFLICT OF INTEREST", 24),
  body(
    "We have each read the foregoing material and understand that there are potential conflicts of interest between myself and my spouse in the matters about which we are consulting you. If either of us desire to have separate counsel or desire you not to be involved at all, that spouse shall notify you. We each hereby consent to having you represent both of us in the drafting of our estate planning documents and we each hereby waive any potential or actual conflicts of interest. We understand that since you will be representing both of us on the same matter, as between ourselves and you, there are no confidential communications."
  ),
  ...coupleSignatureBlock(),

  // Extra space so this section reads as distinct from the waiver above it.
  centeredTitle("LIMITED POWER OF ATTORNEY", 24, { spaceBefore: 720 }),
  body(
    "This representation may require the preparation and execution of Deeds and other conveyance instruments that must be recorded. I grant to Speedwell Law a limited power of attorney to correct typographic errors and amend formatting on conveyance instruments in order to facilitate recordation of the same."
  ),
  ...coupleSignatureBlock(),
  new Paragraph({ children: [new PageBreak()] }),
];

const RATE_COLS = [6360, 3000];
const rateRow = (label, amount, boldRow = false) =>
  new TableRow({
    children: [
      cell([new Paragraph({ children: [run(label, { bold: boldRow })] })], { width: { size: RATE_COLS[0], type: WidthType.DXA } }),
      cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(amount, { bold: boldRow })] })], { width: { size: RATE_COLS[1], type: WidthType.DXA } }),
    ],
  });

const exhibitA = [
  centeredTitle("EXHIBIT A", 24),
  centeredTitle("ESTATE PLANNING SERVICES AND PRICES", 24),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run("2026 Hourly Rates", { bold: true })] }),
  new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: RATE_COLS,
    rows: [
      rateRow("Premium Attorney", "$625"),
      rateRow("Senior Attorney", "$450"),
      rateRow("Associate", "$350"),
      rateRow("Paralegal", "$185"),
      rateRow("Legal Assistant", "$125"),
    ],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 160 }, children: [run("(Only valid for 2026)")] }),
  ...coupleSignatureBlock(),
  new Paragraph({ children: [new PageBreak()] }),
];

const exhibitB = [
  centeredTitle("EXHIBIT B", 24),
  centeredTitle("CLIENT EXPECTATIONS AGREEMENT", 24),
  new Paragraph({ numbering: { reference: "exhibit-b", level: 0 }, alignment: AlignmentType.JUSTIFIED, children: [run("I understand that meetings canceled less than 1 business day in advance carry a $100 cancellation fee.")] }),
  new Paragraph({ numbering: { reference: "exhibit-b", level: 0 }, alignment: AlignmentType.JUSTIFIED, children: [run("I understand that if I reschedule the Document Tour, half the fee will be collectible as of that date.")] }),
  new Paragraph({ numbering: { reference: "exhibit-b", level: 0 }, alignment: AlignmentType.JUSTIFIED, children: [run("I understand that if I reschedule the Document Tour a second time, the full fee will be collectible as of the date of the second scheduled Document Tour.")] }),
  new Paragraph({ numbering: { reference: "exhibit-b", level: 0 }, alignment: AlignmentType.JUSTIFIED, children: [run("I understand that the estate planning experience is designed and expected to last for 90 days. If my documents are not signed within 90 days, then a $50 per month administrative fee will apply, which will be charged to my credit card on file.")] }),
  // Aligned with the numbered items (0.5" indent) per Misha's formatting spec.
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 720 },
    spacing: { before: 120, after: 120 },
    children: [run("Speedwell Law is nevertheless understanding of the fact that the following circumstances can afflict anyone at any time and would understandably cause a delay or pause in the estate planning process:")],
  }),
  new Paragraph({ numbering: { reference: "exhibit-b-bullets", level: 0 }, children: [run("Death in the immediate family")] }),
  new Paragraph({ numbering: { reference: "exhibit-b-bullets", level: 0 }, children: [run("Diagnosis of severe disease")] }),
  new Paragraph({ numbering: { reference: "exhibit-b-bullets", level: 0 }, children: [run("Divorce")] }),
  new Paragraph({ numbering: { reference: "exhibit-b-bullets", level: 0 }, children: [run("Birth of a child")] }),
  new Paragraph({ numbering: { reference: "exhibit-b", level: 0 }, alignment: AlignmentType.JUSTIFIED, children: [run("If I experience any of the aforementioned events, I will notify Speedwell Law within 14 days (two weeks) and Speedwell Law will pause the representation.")] }),
  new Paragraph({ numbering: { reference: "exhibit-b", level: 0 }, alignment: AlignmentType.JUSTIFIED, children: [run("I will provide edits to my estate planning documents at least two business days prior to my signing ceremony or my signing ceremony may be delayed. If a remote signing is scheduled, the deadline will be five business days.")] }),
  new Paragraph({ numbering: { reference: "exhibit-b", level: 0 }, alignment: AlignmentType.JUSTIFIED, children: [run("I understand that I am responsible for funding my trust. Speedwell Law will provide general coaching and direction regarding trust funding during the planning process. Ongoing trust funding oversight, review, and maintenance are available through separate services, including the Probate Avoidance Club, governed by a separate agreement.")] }),
  ...coupleSignatureBlock(),
];

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

const letterhead = fs.readFileSync(path.join(__dirname, "letterhead.jpg"));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
  numbering: {
    config: [
      {
        reference: "ra-sections",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 } } } }],
      },
      {
        reference: "exhibit-b",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
      {
        reference: "exhibit-b-bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
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
              children: [
                new TextRun({ font: FONT, size: 18, children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }),
              ],
            }),
          ],
        }),
      },
      children: [...proposalPage, ...agreement, ...waiverAndPoa, ...exhibitA, ...exhibitB],
    },
  ],
});

const outPath = path.resolve(__dirname, "..", "..", "templates", "ra", "RA-EP-Couple-tokenized.docx");
Packer.toBuffer(doc).then((buffer) => {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log(`Written: ${outPath} (${buffer.length} bytes)`);
});
