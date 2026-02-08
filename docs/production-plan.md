# Appergy Scanner — Production Plan

Owner: James  
Version: 1.0

## Phase 0 — Foundations
- Ensure TypeScript, linting, and tests run cleanly
- Firebase/Firestore connection verified
- Establish services folder for scan logic

## Phase 1 — Scan Session Lifecycle
- Create scan session on scan start
- Track attempts per session
- Persist every attempt and result (including MRR)
- Implement 3-fail MRR escalation logic
- Handle session completion vs abandonment

## Phase 2 — Results UX (Locked)
- Global verdict header (✅ ❌ 🟡)
- Per-profile cards
- Grouped findings:
  - ❌ Allergens
  - ⛔ Preferences
  - ⚠️ Inferred risks
- Always-visible actions:
  - Rescan
  - Confirm item name
  - Correct this result

## Phase 3 — Item Fingerprinting + Overrides
- Generate stable fingerprint per spec
- Apply overrides automatically on future scans
- Show “Corrected by you” badge
- Persist corrections and overrides

## Phase 4 — Inference Escalation
- Maintain “very bad allergy” allowlist
- Escalate inferred severe risks to allergens
- Update verdict and trigger alerts

## Phase 5 — History + Alerts
- History saved for every scan (idempotent)
- Admin alerts created only for allergen involvement

## Release Requirements
- All acceptance criteria satisfied
- No secrets committed
- Plain-language output only
- MRR logic verified