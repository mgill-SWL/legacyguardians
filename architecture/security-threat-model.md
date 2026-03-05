# Legacy Guardians — Security Threat Model (Practical)

Legacy Guardians (LG) is an estate planning + administration law firm SaaS with a client portal (magic-link preferred), trust accounting from day 1, and integrations:
- **Lawmatics**: CRM source of truth
- **CosmoLex**: billing/accounting destination for time/billing entries until Jan 2027

This threat model focuses on realistic attackers, assets, trust boundaries, and key abuse cases, with implementable mitigations.

## 1) Security Objectives

1. **Confidentiality** of privileged materials (attorney notes, executed documents).
2. **Integrity** of trust accounting and financial records.
3. **Availability** of portal and accounting workflows.
4. **Non-repudiation & auditability** for financial and privileged actions.
5. **Least privilege** across staff, clients, and integrations.

## 2) Primary Assets

### A) Legal/privileged assets (highest confidentiality)
- Attorney notes and work product
- Client communications
- Scanned executed documents

### B) Trust accounting & financial assets (highest integrity)
- **Matter-level** trust ledgers (Stage 1: backed by a single firm IOLTA account), disbursement batches, reconciliation reports
- Approval workflows and audit trails
- CosmoLex sync state and transaction references (including invoice linkage for earned-fee transfers)

### C) Identity & access
- User accounts (staff + clients)
- Magic-link issuance and redemption flows
- Sessions, device identifiers, API keys, signing keys

### D) Business/operational
- Matter metadata (5-year retention requirement)
- Integration configs (Lawmatics/CosmoLex tokens)
- Audit logs (must be tamper-evident)

## 3) Threat Actors

- **External opportunistic attacker**: credential stuffing, token theft, phishing.
- **Targeted attacker**: aims for high-value estates/trust accounts.
- **Malicious or compromised client email**: intercepts magic link.
- **Malicious insider (firm staff)**: snooping, data export, financial manipulation.
- **Compromised staff endpoint**: malware steals session tokens.
- **Integration/vendor compromise**: Lawmatics/CosmoLex token theft, webhook spoofing.
- **Support/operator error**: misconfig, overly broad access.

## 4) Trust Boundaries & Data Flows

1. **Client device + email** → LG magic-link auth endpoint
2. **Firm staff device** → LG staff app
3. **LG application services** → LG databases + document storage
4. **LG** ↔ **Lawmatics** (sync/contact updates)
5. **LG** → **CosmoLex** (time/billing + possibly trust-related entries depending on integration)
6. **LG** → **Email provider** (magic link delivery)
7. **LG** → **Logging/monitoring system** (audit + security logs)

Each boundary is a potential injection, spoofing, replay, or exfiltration point.

## 5) Key Abuse Cases (with mitigations)

### 5.1 Magic-link token theft / replay
**Scenario:** attacker steals a magic link from an inbox, forwarded mail, or logs and redeems it.

**Mitigations (implementable):**
- **Short expiry**: 10–15 minutes default; configurable.
- **Single-use**: redeem invalidates token immediately.
- **Store only hashes**: store `sha256(token)` with salt/pepper; never store raw.
- **Bind to context (options):**
  - *Soft device binding*: remember a device cookie; if new device, step-up verification.
  - Hard binding is brittle; prefer soft + anomaly checks.
- **Rate limit** issuance and redemption by IP + email + firm.
- **Replay protection**: nonce + redeemed-at timestamp; reject second redemption.
- **Deliverability**: DKIM/SPF/DMARC aligned; dedicated sending domain; monitor bounces/complaints.
- **Fallback recovery**: allow clients to set backup email or secondary factor (post-first-login), without passwords.

### 5.2 Client account takeover via email compromise
**Scenario:** client’s email is compromised; attacker uses magic links.

**Mitigations:**
- Step-up for sensitive actions (download executed docs, export, changing contact info).
- Notify client + firm on new-device login/unusual geo.
- Fast session revocation by firm admins.

### 5.3 Staff credential phishing / session theft
**Scenario:** attacker phishes staff credentials or steals session token from endpoint.

**Mitigations:**
- Staff auth stronger than clients: password + MFA or SSO.
- Short-lived access tokens + refresh rotation; secure, httpOnly cookies.
- Step-up for exports, integration config, trust approvals.

### 5.4 Unauthorized access to attorney notes
**Scenario:** billing staff or client sees privileged notes.

**Mitigations:**
- Separate permissions for notes (`notes.read`) gated by attorney/partner roles + matter membership.
- Deny-by-default sharing for notes.
- Audit all note access.

### 5.5 Trust accounting fraud (insider or compromised staff)
**Scenario:** staff creates disbursement to attacker-controlled payee and approves/syncs.

**Mitigations (must-have):**
- **Segregation of duties**: creator cannot approve.
- **Dual approval** above thresholds or for new payees.
- **Immutable audit trail** of ledger/disbursement lifecycle.
- **Invoice gating for withdrawals:** earned-fee transfers (trust → operating) require a linked invoice id/number (and external/CosmoLex invoice reference during interim), preventing arbitrary “fee” pulls.
- Payee allowlists + change detection.
- Reconciliation workflow + anomaly alerts.
- Idempotent CosmoLex sync; signed requests/webhooks if supported.

### 5.6 Integration token leakage
**Scenario:** Lawmatics/CosmoLex tokens exposed via logs or config.

**Mitigations:**
- Store tokens in a secrets manager; strict access controls.
- Redact tokens from logs.
- Rotate tokens; track last-used.
- Use least-privilege vendor scopes.

### 5.7 Webhook spoofing / data poisoning
**Scenario:** attacker sends fake webhooks to create/modify records.

**Mitigations:**
- Verify webhook signatures (HMAC) if supported.
- IP allowlist if vendor provides stable ranges.
- Replay protection via timestamps/nonces.
- Schema validation + strict firm scoping.

### 5.8 Mass export / exfiltration
**Scenario:** compromised account exports many documents.

**Mitigations:**
- Rate limits and export quotas.
- Large export requires step-up.
- Alert on unusual download volume.
- Log document ids included in exports.

### 5.9 Ransomware / destructive actor
**Scenario:** attacker deletes or encrypts data.

**Mitigations:**
- Backups with immutability; tested restores.
- Object storage versioning for documents.
- Strict deletion permissions + approvals for destructive actions.

## 6) “Zero Trust” and “End-to-End Encryption” (realistic options)

### Zero Trust (implementable interpretation)
“Zero trust” here means: **every request is authenticated, authorized, and logged**; no implicit trust based on network location.

Implementable steps:
- Central auth; short-lived tokens; rotate refresh tokens.
- Fine-grained authorization checks per request (`firm_id`, `matter_id`, role).
- Service-to-service auth using mTLS or signed JWTs.
- No broad internal admin access; break-glass with approval + time limit.

Tradeoffs:
- More complexity (policy layer, observability).
- More friction if step-up is overused—use risk-based triggers.

### End-to-end encryption (E2EE) options
True E2EE means the server cannot decrypt content; difficult with search, previews, virus scanning, e-discovery, and multi-party sharing.

**Option 1 (recommended now): strong server-side encryption (SSE) + envelope encryption**
- Encrypt documents at rest with per-object data keys wrapped by KMS.
- Strict KMS IAM policies.
- Pros: practical; supports scanning/search.
- Cons: not E2EE; server can decrypt.

**Option 2 (partial E2EE): client-side encryption for a subset (e.g., attorney notes)**
- Encrypt in browser; server stores ciphertext.
- Pros: reduces server visibility.
- Cons: key recovery/sharing/revocation are hard; complicates support.

**Option 3 (full E2EE for documents):** possible but major product/UX lift.

Do not market “E2EE” unless Option 2/3 is actually implemented.

## 7) AI Features — HITL Requirements

If LG includes AI (summaries, intake drafting, classification):

### Human-in-the-loop (HITL) must-haves
- AI output is **suggestion only**; user must review + accept.
- Clear labeling of AI-generated content.
- No automated filing or sending without explicit human confirmation.
- Audit: requestor, model/version, whether output was saved/shared.

### Data handling constraints
Default: do not send Level 3/4 data to external model providers unless contractually allowed (no training), minimal necessary content, and explicit customer opt-in.

### Abuse cases + mitigations
- Prompt injection from uploaded docs → constrain tools, matter-scoped retrieval, strict function permissions.
- Hallucinated legal advice → disclaimers + required attorney review.

## 8) Baseline Security Controls Checklist

- TLS everywhere; HSTS.
- Secure cookie settings; CSRF protection where applicable.
- Input validation; file upload scanning.
- Least-privilege IAM; separate environments.
- Secrets management + rotation.
- Immutable audit logging.
- Backups + restore drills.
- Security monitoring + incident response runbooks.

## 9) Open Questions (to validate with counsel/ops)

- Statutory retention requirements for trust accounting records in VA/MD beyond the provided minimums.
- Whether clients should ever see trust ledger details in portal.
- Exact CosmoLex integration scope (time/billing only vs trust-related entries), especially around **invoice-linked earned-fee transfers**.

## Clarifications applied (2026-03-05)

- Stage 1 assumes **one IOLTA trust bank account per firm**, which increases the importance of preventing cross-matter misallocation; treat `matter_id` as the primary ledger boundary.
- Trust ledgers are **matter-level** (no shared ledgers across matters).
- Earned-fee transfers (trust → operating) are treated as a high-risk withdrawal path and must be **invoice-linked**.
