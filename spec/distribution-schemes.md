# Legacy Guardians — Distribution Schemes (Draft Spec)

Version: v0.1 (draft)
Date: 2026-03-11

This spec defines how LG represents and assembles trust **distribution arrangements**, especially **residuary/remainder** schemes.

## 1) Core concepts

### 1.1 Terms
- **NI**: net income distribution milestone (e.g., “mandatory net income distributions beginning at age X”).
- **ROW**: “right of withdrawal” milestone(s) for principal.
- **Child level**: distributions to a settlor’s child (or an initial generation beneficiary).
- **Remote descendant level**: distributions to descendants more remote than a child (e.g., grandchildren).

### 1.2 Design goals
- Deterministic assembly: a selected scheme maps to a specific clause variant.
- Clear separation:
  - coaching logic (UI prompts, later) vs
  - clause selection (assembly engine).

## 2) Supported residual/remainder scheme families (Stage 1 — VA)

### 2.1 Standard residual distribution (age-staged)
A residuary scheme that divides residue (often per stirpes / per capita at each generation per selection) and applies NI/ROW timing.

**Parameters (initial draft):**
- `division_method`: `per_stirpes` | `per_capita_at_each_generation`
- `ni_start_age`: 21 | 25 | null (if no mandatory NI milestone)
- `row_schedule` (ordered list):
  - `[{ age: 25, max_fraction: 1.0 }]` (single milestone)
  - `[{ age: 25, max_fraction: 0.5 }, { age: 30, max_fraction: 1.0 }]`
  - `[{ age: 25, max_fraction: 1/3 }, { age: 30, max_fraction: 2/3 }, { age: 35, max_fraction: 1.0 }]`
  - UHNW variant: `[{ age: 40, max_fraction: 1.0 }]` (when applicable)

**Implementation note:** “max_fraction” is the cumulative cap by that age; at the final milestone it should equal 1.0.

### 2.2 Bloodline trust residual distribution
A residuary scheme that replaces the standard residual clause with a multi-generational continuing trust structure.

**Characteristics captured (from user guidance):**
- Replaces the residual distribution clause.
- Holds residue in continuing trusts across generations to benefit descendants.

## 3) Child-level vs remote-descendant-level restrictions

### 3.1 Child-level staging
LG should support staged ROW restrictions at the **child level**, including:
- 25/30 (1/2 then remainder)
- 25/30/35 (thirds)

### 3.2 Remote descendant default (non-UHNW coaching principle)
**Rule-of-thumb:** for non-UHNW plans, keep grandchild/remote-descendant-level distributions **less restrictive by default**.

Rationale: staged withdrawal mechanics for remote descendants can significantly **elongate trustee administration burdens**; default coaching is to “ease off the throttle” for grandkids.

**Assembly implication:** unless explicitly selected, do not automatically propagate child-level staged ROW schedules to remote-descendant clauses.

## 4) Clause mapping (initial)
- Standard residual clause variants exist in `clauses/text/…` (e.g., principal/income at 25; NI@21 + ROW staged).
- Bloodline residual clause captured in `clauses/text/residual-distribution-clause-bloodline-trust.md`.

## 5) Coaching prompts (deferred)
Coaching prompts should be treated as a separate module (likely agent-backed) once UI exists. For now, LG should:
- store a selected scheme deterministically,
- leave a placeholder surface for future coaching.
