"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import styles from "./estatePlanningProposal.module.css";

type AttorneyTier = "premium" | "senior" | "fresh";

type ToggleKey =
  | "willBase"
  | "livingTrust"
  | "revision"
  | "incapacityOnly"
  | "deedRepresentation"
  | "incapacityDocs"
  | "creditorProtections"
  | "blendedFamily"
  | "taxPlanning"
  | "peaceOfMind"
  | "inPerson"
  | "textAttorney"
  | "rush"
  | "bedside"
  | "translation"
  | "paymentDueDesign"
  | "paymentPlan"
  | "serviceDiscount"
  | "sameDayBinder"
  | "sameDayCredit";

type LineItem = {
  key: string;
  label: string;
  amountCents: number;
  kind: "base" | "enhancement" | "convenience" | "deed" | "courtesy" | "bonus" | "manual";
  summary: string;
};

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ATTORNEY_TIERS: Record<
  AttorneyTier,
  { label: string; attorney: string; trustUpgradeCents: number; note: string }
> = {
  premium: {
    label: "Premium",
    attorney: "Misha Gill",
    trustUpgradeCents: 0,
    note: "Anchor package for clients who specifically want Misha and premium service features.",
  },
  senior: {
    label: "Senior Associate",
    attorney: "Alexandra",
    trustUpgradeCents: 80000,
    note: "Default fit for most comprehensive estate planning clients.",
  },
  fresh: {
    label: "Fresh Face",
    attorney: "Arjan",
    trustUpgradeCents: 50000,
    note: "Lower trust upgrade and friendlier payment-plan posture.",
  },
};

const FEATURE_COPY: Partial<Record<ToggleKey, { title: string; body: string[]; close?: string }>> = {
  livingTrust: {
    title: "Living trust conversation",
    body: [
      "Ask whether they were interested in creating a living trust as part of the estate plan. If they already know they want a trust, affirm it and move directly into tiers and service features.",
      "If they seem will-oriented, educate before quoting: a trust costs more up front, but for most families it saves loved ones more time, expense, and stress later.",
      "A will can still fit when everything passes equally to children, the children can comfortably serve together, and there is no out-of-state property.",
    ],
    close:
      "For most families, the trust plan provides the cleanest probate-avoidance, privacy, and successor-management value.",
  },
  incapacityDocs: {
    title: "Incapacity planning documents",
    body: [
      "Recommend this to nearly every full estate planning client unless they already have current, valid documents and do not want them updated.",
      "Explain it as the set of documents that lets trusted people step in for financial, medical, HIPAA, and burial decisions if the client becomes incapacitated.",
    ],
  },
  creditorProtections: {
    title: "Enhanced creditor protections",
    body: [
      "Offer when a living person will inherit. Omit mainly when the plan leaves everything to charity.",
      "This gives the trustee flexibility to protect beneficiaries facing addiction, incapacity, divorce, lawsuits, public-benefit issues, creditor claims, or poor financial judgment.",
    ],
  },
  blendedFamily: {
    title: "Blended family enhancement",
    body: [
      "Use when either spouse has children from a prior relationship, spouses have different intended distributions, or there is concern about protecting first-marriage children or separate assets.",
      "Skip it if both spouses truly agree all assets pass equally to all children as one unified family.",
    ],
    close:
      "Position it as two coordinated estate plans under one household without charging a whole second estate plan fee.",
  },
  peaceOfMind: {
    title: "Peace of Mind Guarantee",
    body: [
      "Use this as confidence and decision-finality assurance, not as a refund script.",
      "If the client is confident their wishes are simple and unlikely to change, declining it can support a modest fee reduction later.",
    ],
  },
  rush: {
    title: "Rush service",
    body: [
      "Use for serious timing pressure: medical events, travel, imminent closing/deployment, or a genuine deadline.",
      "Document the urgency clearly so the production team knows why the matter jumped the normal queue.",
    ],
  },
  bedside: {
    title: "Bedside service",
    body: [
      "Use for clients unable to come to the office or attend remotely because of illness, mobility limitations, or facility placement.",
      "Confirm location, signing capacity concerns, and whether witness/notary logistics need attorney review.",
    ],
  },
  translation: {
    title: "Translation services",
    body: [
      "Full-service estate planning translation is materially different from documents-only support. Confirm language, meetings affected, and whether professional interpretation is required.",
    ],
  },
};

const INITIAL_TOGGLES: Record<ToggleKey, boolean> = {
  willBase: true,
  livingTrust: true,
  revision: false,
  incapacityOnly: false,
  deedRepresentation: false,
  incapacityDocs: true,
  creditorProtections: true,
  blendedFamily: false,
  taxPlanning: false,
  peaceOfMind: true,
  inPerson: false,
  textAttorney: false,
  rush: false,
  bedside: false,
  translation: false,
  paymentDueDesign: true,
  paymentPlan: false,
  serviceDiscount: false,
  sameDayBinder: true,
  sameDayCredit: true,
};

function dollars(cents: number) {
  return MONEY.format(cents / 100);
}

function ToggleRow({
  title,
  detail,
  checked,
  onChange,
  amount,
  disabled,
}: {
  title: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  amount?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`${styles.toggleRow} ${disabled ? styles.disabled : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.toggleText}>
        <span className={styles.toggleTitle}>{title}</span>
        {detail ? <span className={styles.toggleDetail}>{detail}</span> : null}
      </span>
      {amount ? <span className={styles.amountPill}>{amount}</span> : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helper: string;
}) {
  return (
    <label className={styles.numberField}>
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      <small>{helper}</small>
    </label>
  );
}

function CoachingPanel({ feature }: { feature: ToggleKey }) {
  const copy = FEATURE_COPY[feature];
  if (!copy) return null;

  return (
    <div className={styles.coachingPanel}>
      <div className={styles.coachingTitle}>{copy.title}</div>
      {copy.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {copy.close ? <blockquote>{copy.close}</blockquote> : null}
    </div>
  );
}

type EstatePlanningProposalProps = {
  embedded?: boolean;
  initialClientName?: string;
  initialOffice?: string;
  initialSource?: string;
  leadId?: string;
  leadHref?: string;
};

export function EstatePlanningProposal({
  embedded = false,
  initialClientName = "",
  initialOffice = "Alexandria",
  initialSource = "Google PPC",
  leadId,
  leadHref,
}: EstatePlanningProposalProps = {}) {
  const router = useRouter();
  const [clientName, setClientName] = useState(initialClientName);
  const [source, setSource] = useState(initialSource);
  const [office, setOffice] = useState(initialOffice);
  const [salesperson, setSalesperson] = useState("Christopher Heredia");
  const [tier, setTier] = useState<AttorneyTier>("senior");
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(INITIAL_TOGGLES);
  const [vaDeeds, setVaDeeds] = useState(0);
  const [outOfStateDeeds, setOutOfStateDeeds] = useState(0);
  const [businessAssignments, setBusinessAssignments] = useState(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [scrs, setScrs] = useState("5");
  const [notes, setNotes] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  function setToggle(key: ToggleKey, checked: boolean) {
    setToggles((prev) => {
      const next = { ...prev, [key]: checked };
      if (key === "revision" && checked) {
        next.willBase = false;
        next.livingTrust = false;
        next.incapacityOnly = false;
      }
      if (key === "incapacityOnly" && checked) {
        next.willBase = false;
        next.livingTrust = false;
        next.revision = false;
        next.incapacityDocs = false;
      }
      if (key === "willBase" && checked) {
        next.revision = false;
        next.incapacityOnly = false;
      }
      if (key === "livingTrust" && checked) {
        next.willBase = true;
        next.revision = false;
        next.incapacityOnly = false;
      }
      if (key === "paymentPlan" && checked) next.paymentDueDesign = false;
      if (key === "paymentDueDesign" && checked) next.paymentPlan = false;
      return next;
    });
  }

  async function prepareAgreement() {
    if (!leadId) return;
    setPreparing(true);
    setPrepareError(null);
    try {
      for (const action of ["proposal_prepared", "ra_prepared"]) {
        const res = await fetch(`/api/crm/leads/${leadId}/engagement`, {
          body: JSON.stringify({ action }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e: any) {
      setPrepareError(e?.message || "Failed to prepare agreement");
    } finally {
      setPreparing(false);
    }
  }

  const quote = useMemo(() => {
    const lines: LineItem[] = [];
    const selectedTier = ATTORNEY_TIERS[tier];

    if (tier === "premium") {
      lines.push({
        key: "premium",
        label: "Premium attorney package",
        amountCents: 997500,
        kind: "base",
        summary:
          "Work with Misha Gill personally; includes premium service features, up to three deeds, payment before booking the Design Meeting, and Probate Avoidance Club admission.",
      });
    } else {
      if (toggles.revision) {
        lines.push({
          key: "revision",
          label: "Revision of existing estate plan",
          amountCents: 300000,
          kind: "base",
          summary:
            "Minimum fee for review and revision of an existing estate plan; overages may be billed at the assigned attorney's hourly rate.",
        });
      } else if (toggles.incapacityOnly) {
        lines.push({
          key: "incapacityOnly",
          label: "Incapacity planning documents only",
          amountCents: 179500,
          kind: "base",
          summary:
            "Standalone POA, Advance Medical Directive, HIPAA Authorization, and Burial Power of Attorney representation.",
        });
      } else if (toggles.willBase) {
        lines.push({
          key: "willBase",
          label: "Will base price",
          amountCents: 280000,
          kind: "base",
          summary:
            "Establishes the core will-based estate plan, including wishes, fiduciaries, and guardianship designations.",
        });
      }

      if (toggles.livingTrust) {
        lines.push({
          key: "livingTrust",
          label: `Living trust upgrade (${selectedTier.label})`,
          amountCents: selectedTier.trustUpgradeCents,
          kind: "base",
          summary: `Adds trust-based planning with ${selectedTier.attorney} as the assigned attorney tier.`,
        });
      }
    }

    if (toggles.incapacityDocs) {
      lines.push({
        key: "incapacityDocs",
        label: "Incapacity planning docs",
        amountCents: 19500,
        kind: "enhancement",
        summary:
          "Adds POA, Advance Medical Directive, HIPAA Authorization, and Burial Power of Attorney documents.",
      });
    }
    if (toggles.creditorProtections) {
      lines.push({
        key: "creditorProtections",
        label: "Enhanced creditor protections",
        amountCents: 19500,
        kind: "enhancement",
        summary:
          "Adds trustee flexibility to protect beneficiaries from creditor, divorce, incapacity, substance-use, and similar risks.",
      });
    }
    if (toggles.blendedFamily) {
      lines.push({
        key: "blendedFamily",
        label: "Blended family enhancement",
        amountCents: 50000,
        kind: "enhancement",
        summary:
          "Adds coordinated design work for spouses with prior-relationship children or different distribution goals.",
      });
    }
    if (toggles.taxPlanning) {
      lines.push({
        key: "taxPlanning",
        label: "Irrevocable trust / tax planning enhancement",
        amountCents: 0,
        kind: "enhancement",
        summary: "Attorney review required before quoting this enhancement.",
      });
    }
    if (toggles.inPerson) {
      lines.push({
        key: "inPerson",
        label: "In-person consultations",
        amountCents: 19500,
        kind: "convenience",
        summary:
          "Provides in-office Design Meeting and Document Tour appointments for clients who prefer face-to-face meetings.",
      });
    }
    if (toggles.textAttorney) {
      lines.push({
        key: "textAttorney",
        label: "Text my attorney",
        amountCents: 19500,
        kind: "convenience",
        summary: "Feature currently marked unavailable; include only with attorney approval.",
      });
    }
    if (toggles.rush) {
      lines.push({
        key: "rush",
        label: "Rush service",
        amountCents: 50000,
        kind: "convenience",
        summary: "Expedites completion for urgent timing needs and prioritizes drafting work.",
      });
    }
    if (toggles.bedside) {
      lines.push({
        key: "bedside",
        label: "Bedside service",
        amountCents: 80000,
        kind: "convenience",
        summary:
          "Provides in-home or facility-based meetings for clients unable to travel to the office.",
      });
    }
    if (toggles.translation) {
      lines.push({
        key: "translation",
        label: "Translation services",
        amountCents: toggles.incapacityOnly ? 89500 : 160000,
        kind: "convenience",
        summary:
          "Supports estate planning meetings and documents in the client's preferred language.",
      });
    }

    if (vaDeeds > 0) {
      lines.push({
        key: "vaDeeds",
        label: `Virginia deeds (${vaDeeds})`,
        amountCents: vaDeeds * 37500,
        kind: "deed",
        summary: "Preparation and recording coordination for Virginia property deeds.",
      });
    }
    if (outOfStateDeeds > 0) {
      lines.push({
        key: "outOfStateDeeds",
        label: `Out-of-state deeds (${outOfStateDeeds})`,
        amountCents: outOfStateDeeds * 20000,
        kind: "deed",
        summary: "Coordination fee for out-of-state deed preparation through trusted vendor support.",
      });
    }
    if (businessAssignments > 0) {
      lines.push({
        key: "businessAssignments",
        label: `Business assignments (${businessAssignments})`,
        amountCents: businessAssignments * 20000,
        kind: "deed",
        summary: "Assignment documents to transfer business interests into trust planning.",
      });
    }

    if (toggles.peaceOfMind) {
      lines.push({
        key: "peaceOfMind",
        label: "Peace of Mind Guarantee",
        amountCents: 0,
        kind: "bonus",
        summary:
          "Gives the client confidence that Speedwell Law stands behind the plan and revision process.",
      });
    }
    if (toggles.paymentDueDesign) {
      lines.push({
        key: "paymentDueDesign",
        label: "Courtesy extension: payment due at Design Meeting",
        amountCents: 0,
        kind: "courtesy",
        summary: "Payment due after the client has finalized the plan at the Design Meeting.",
      });
    }
    if (toggles.paymentPlan) {
      lines.push({
        key: "paymentPlan",
        label: "Courtesy extension: three-month payment plan",
        amountCents: 0,
        kind: "courtesy",
        summary: "Three monthly installments; confirm availability before sending agreement.",
      });
    }
    if (toggles.serviceDiscount) {
      lines.push({
        key: "serviceDiscount",
        label: "Military / teacher / first responder adjustment",
        amountCents: -5000,
        kind: "courtesy",
        summary: "Courtesy adjustment for military, teacher, or first responder client.",
      });
    }
    if (toggles.sameDayCredit) {
      lines.push({
        key: "sameDayCredit",
        label: "Same-day booking credit",
        amountCents: -5000,
        kind: "bonus",
        summary: "Same-day booking credit for clients who schedule the Design Meeting promptly.",
      });
    }
    if (toggles.sameDayBinder) {
      lines.push({
        key: "sameDayBinder",
        label: "Free estate planning binder",
        amountCents: 0,
        kind: "bonus",
        summary: "Gold embossed faux leather estate planning binder with divider inserts.",
      });
    }
    if (manualAdjustment !== 0) {
      lines.push({
        key: "manualAdjustment",
        label: manualAdjustment > 0 ? "Manual fee addition" : "Manual fee adjustment",
        amountCents: Math.round(manualAdjustment * 100),
        kind: "manual",
        summary: "Manual override or attorney-approved adjustment.",
      });
    }

    const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
    return { lines, totalCents };
  }, [businessAssignments, manualAdjustment, outOfStateDeeds, tier, toggles, vaDeeds]);

  const activeCoaching = (Object.keys(FEATURE_COPY) as ToggleKey[]).filter((key) => toggles[key]);
  const requiredWarning = !clientName.trim() || !scrs;

  return (
    <div className={`${styles.page} ${embedded ? styles.embeddedPage : ""}`}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>
            {leadHref ? <a href={leadHref}>Lead record</a> : "CRM / Sales"}
          </div>
          <h1 className={styles.title}>Estate Planning Proposal</h1>
          <p className={styles.subcopy}>
            Purpose-built estate planning proposal workflow for discovery calls,
            proposal math, and representation-agreement line items.
          </p>
        </div>
        <div className={styles.headerMeta}>
          <span>{quote.lines.length} quote lines</span>
          <strong>{dollars(quote.totalCents)}</strong>
        </div>
      </header>

      <div className={styles.layout}>
        <main className={styles.formColumn}>
          <section className={styles.band}>
            <div className={styles.bandHeader}>
              <div>
                <h2>Client context</h2>
                <p>Capture the minimum facts needed to quote and route the matter.</p>
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Salesperson</span>
                <input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>Client name</span>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or household name" />
              </label>
              <label className={styles.field}>
                <span>Source</span>
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option>Google PPC</option>
                  <option>Referral</option>
                  <option>Website</option>
                  <option>Existing client</option>
                  <option>Other</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Office location</span>
                <select value={office} onChange={(e) => setOffice(e.target.value)}>
                  <option>Alexandria</option>
                  <option>Merrifield</option>
                  <option>Remote</option>
                </select>
              </label>
            </div>
            <div className={styles.calloutLine}>
              Ask: “Just out of curiosity, how did you first learn about Speedwell Law?”
            </div>
          </section>

          <section className={styles.band}>
            <div className={styles.bandHeader}>
              <div>
                <h2>Attorney assignment</h2>
                <p>Start with the right attorney tier, then build the package around the client’s facts.</p>
              </div>
            </div>
            <div className={styles.segmented} role="radiogroup" aria-label="Attorney tier">
              {(Object.entries(ATTORNEY_TIERS) as [AttorneyTier, (typeof ATTORNEY_TIERS)[AttorneyTier]][]).map(
                ([key, option]) => (
                  <button
                    key={key}
                    type="button"
                    className={tier === key ? styles.segmentActive : ""}
                    onClick={() => setTier(key)}
                    aria-pressed={tier === key}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.attorney}</span>
                  </button>
                ),
              )}
            </div>
            <div className={styles.guidanceNote}>{ATTORNEY_TIERS[tier].note}</div>
          </section>

          <section className={styles.band}>
            <div className={styles.bandHeader}>
              <div>
                <h2>Representation option</h2>
                <p>Choose the main package before adding enhancements and convenience upgrades.</p>
              </div>
            </div>
            <div className={styles.toggleGrid}>
              <ToggleRow
                title="Base price / will option"
                detail="Checked unless a standalone package is selected."
                amount="$2,800"
                checked={toggles.willBase}
                onChange={(v) => setToggle("willBase", v)}
                disabled={tier === "premium"}
              />
              <ToggleRow
                title="Living trust upgrade"
                detail={`${ATTORNEY_TIERS[tier].label} tier`}
                amount={tier === "premium" ? "Included" : dollars(ATTORNEY_TIERS[tier].trustUpgradeCents)}
                checked={toggles.livingTrust || tier === "premium"}
                onChange={(v) => setToggle("livingTrust", v)}
                disabled={tier === "premium"}
              />
              <ToggleRow
                title="Revision of existing estate plan"
                detail="Minimum fee; overages may apply."
                amount="$3,000"
                checked={toggles.revision}
                onChange={(v) => setToggle("revision", v)}
                disabled={tier === "premium"}
              />
              <ToggleRow
                title="Incapacity documents only"
                detail="Standalone limited-scope package."
                amount="$1,795"
                checked={toggles.incapacityOnly}
                onChange={(v) => setToggle("incapacityOnly", v)}
                disabled={tier === "premium"}
              />
              <ToggleRow
                title="Deed representation"
                detail="Use when deeds are the primary scope."
                checked={toggles.deedRepresentation}
                onChange={(v) => setToggle("deedRepresentation", v)}
              />
            </div>
            {toggles.livingTrust || tier === "premium" ? <CoachingPanel feature="livingTrust" /> : null}
          </section>

          <section className={styles.band}>
            <div className={styles.bandHeader}>
              <div>
                <h2>Service feature enhancements</h2>
                <p>Selected features reveal call guidance and flow into the quote summary.</p>
              </div>
            </div>
            <div className={styles.toggleGrid}>
              <ToggleRow title="Incapacity planning documents" amount="$195" checked={toggles.incapacityDocs} onChange={(v) => setToggle("incapacityDocs", v)} />
              <ToggleRow title="Enhanced creditor protections" amount="$195" checked={toggles.creditorProtections} onChange={(v) => setToggle("creditorProtections", v)} />
              <ToggleRow title="Blended family" amount="$500" checked={toggles.blendedFamily} onChange={(v) => setToggle("blendedFamily", v)} />
              <ToggleRow title="Irrevocable trust / tax planning" amount="TBD" checked={toggles.taxPlanning} onChange={(v) => setToggle("taxPlanning", v)} />
              <ToggleRow title="Peace of Mind Guarantee" amount="Included" checked={toggles.peaceOfMind} onChange={(v) => setToggle("peaceOfMind", v)} />
            </div>
            <div className={styles.coachingStack}>
              {activeCoaching
                .filter((key) => key !== "livingTrust")
                .map((key) => (
                  <CoachingPanel key={key} feature={key} />
                ))}
            </div>
          </section>

          <section className={styles.band}>
            <div className={styles.bandHeader}>
              <div>
                <h2>Convenience upgrades</h2>
                <p>Add only the logistics the client actually needs.</p>
              </div>
            </div>
            <div className={styles.toggleGrid}>
              <ToggleRow title="In-person consultations" amount="$195" checked={toggles.inPerson} onChange={(v) => setToggle("inPerson", v)} />
              <ToggleRow title="Text my attorney" detail="Feature not currently available." amount="$195" checked={toggles.textAttorney} onChange={(v) => setToggle("textAttorney", v)} />
              <ToggleRow title="Rush service" amount="$500" checked={toggles.rush} onChange={(v) => setToggle("rush", v)} />
              <ToggleRow title="Bedside service" amount="$800" checked={toggles.bedside} onChange={(v) => setToggle("bedside", v)} />
              <ToggleRow title="Translation services" amount={toggles.incapacityOnly ? "$895" : "$1,600"} checked={toggles.translation} onChange={(v) => setToggle("translation", v)} />
            </div>
          </section>

          <section className={styles.band}>
            <div className={styles.bandHeader}>
              <div>
                <h2>Deeds and assignments</h2>
                <p>Use counts instead of separate true/false fields; zero removes the line item.</p>
              </div>
            </div>
            <div className={styles.countGrid}>
              <NumberField label="Virginia deeds" value={vaDeeds} onChange={setVaDeeds} helper="$375 per deed" />
              <NumberField label="Out-of-state deeds" value={outOfStateDeeds} onChange={setOutOfStateDeeds} helper="$200 coordination fee per deed" />
              <NumberField label="Business assignments" value={businessAssignments} onChange={setBusinessAssignments} helper="$200 per assignment" />
            </div>
          </section>

          <section className={styles.band}>
            <div className={styles.bandHeader}>
              <div>
                <h2>Courtesy adjustments and close</h2>
                <p>Capture payment posture, booking bonus, score, and internal notes.</p>
              </div>
            </div>
            <div className={styles.toggleGrid}>
              <ToggleRow title="Payment due at Design Meeting" checked={toggles.paymentDueDesign} onChange={(v) => setToggle("paymentDueDesign", v)} />
              <ToggleRow title="Payment plan" detail="Three monthly installments." checked={toggles.paymentPlan} onChange={(v) => setToggle("paymentPlan", v)} />
              <ToggleRow title="Military / teacher / first responder" amount="-$50" checked={toggles.serviceDiscount} onChange={(v) => setToggle("serviceDiscount", v)} />
              <ToggleRow title="Same-day booking binder" checked={toggles.sameDayBinder} onChange={(v) => setToggle("sameDayBinder", v)} />
              <ToggleRow title="Same-day booking credit" amount="-$50" checked={toggles.sameDayCredit} onChange={(v) => setToggle("sameDayCredit", v)} />
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Manual adjustment</span>
                <input
                  type="number"
                  value={manualAdjustment}
                  onChange={(e) => setManualAdjustment(Number(e.target.value) || 0)}
                />
              </label>
              <label className={styles.field}>
                <span>SCRS</span>
                <select value={scrs} onChange={(e) => setScrs(e.target.value)}>
                  <option value="">Select score</option>
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                  <option>4</option>
                  <option>5</option>
                </select>
              </label>
              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Notes / special instructions</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mobility issues, special needs, other special considerations..."
                />
              </label>
            </div>
          </section>
        </main>

        <aside className={styles.summaryColumn} aria-label="Fee quote summary">
          <div className={styles.summaryCard}>
            <div className={styles.summaryTop}>
              <div>
                <div className={styles.eyebrow}>Quote</div>
                <h2>{clientName.trim() || "Unnamed client"}</h2>
                <p>{salesperson} / {source} / {office}</p>
              </div>
              <strong>{dollars(quote.totalCents)}</strong>
            </div>

            {requiredWarning ? (
              <div className={styles.warningBox}>
                Add client name and SCRS before sending this forward.
              </div>
            ) : null}

            <div className={styles.lineItems}>
              {quote.lines.map((line) => (
                <div className={styles.lineItem} key={line.key}>
                  <div>
                    <strong>{line.label}</strong>
                    <span>{line.summary}</span>
                  </div>
                  <em>{line.amountCents === 0 ? "Included" : dollars(line.amountCents)}</em>
                </div>
              ))}
            </div>

            <div className={styles.generatedBlock}>
              <div className={styles.generatedTitle}>Proposal language</div>
              <p>
                Based on the selected plan and service features, the estimated
                flat fee is <strong>{dollars(quote.totalCents)}</strong>.
                The current assignment is {ATTORNEY_TIERS[tier].label} with{" "}
                {ATTORNEY_TIERS[tier].attorney}. Payment term:{" "}
                {toggles.paymentPlan
                  ? "three-month payment plan"
                  : toggles.paymentDueDesign
                    ? "due at the Design Meeting"
                    : "standard payment timing"}
                .
              </p>
              {notes.trim() ? <p>Internal notes: {notes.trim()}</p> : null}
            </div>

            <div className={styles.packetBlock}>
              <div className={styles.generatedTitle}>Agreement packet</div>
              <ol className={styles.packetSteps}>
                <li>
                  <strong>Proposal table</strong>
                  <span>Quote lines flow into the front-page customized estate planning proposal.</span>
                </li>
                <li>
                  <strong>Representation agreement</strong>
                  <span>Client names, date, lead attorney, email, fee terms, and selected features populate the RA.</span>
                </li>
                <li>
                  <strong>Documenso placeholders</strong>
                  <span>
                    Use <code>{"{{signature, r1}}"}</code> / <code>{"{{date, r1}}"}</code> and{" "}
                    <code>{"{{signature, r2}}"}</code> / <code>{"{{date, r2}}"}</code> before PDF upload.
                  </span>
                </li>
              </ol>
            </div>

            <div className={styles.actionRow}>
              <button type="button" className={styles.secondaryButton}>
                Save draft
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={requiredWarning || preparing || !leadId}
                onClick={prepareAgreement}
              >
                {preparing ? "Preparing..." : "Prepare agreement"}
              </button>
            </div>
            {prepareError ? <p style={{ color: "var(--sw-danger)", fontSize: 13 }}>{prepareError}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
