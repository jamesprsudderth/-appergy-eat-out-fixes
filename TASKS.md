# Appergy Scanner — Commit-by-Commit Task Plan

Branch rule:
- ALL work must be done on branch `nightly-agent`
- Commits must be made in the order listed
- Do not skip commits
- If blocked, STOP and write a BLOCKERS section at the bottom

Specs (source of truth):
- docs/vision.md
- docs/production-plan.md
- docs/scan-state-machine-firestore-model-results-ux.md
- docs/scanHelpers.ts-spec.md

------------------------------------------------------------
COMMIT 01 — Add scanHelpers.ts (core logic) [DONE]
------------------------------------------------------------
Commit message:
feat(scan): add scanHelpers core logic

Tasks:
- [x] Create `src/services/scanHelpers.ts`
- [x] Paste the full approved implementation exactly as specified
- [x] Export all helper functions
- [x] Do NOT change logic or behavior

Acceptance:
- [x] File compiles
- [x] No unused exports
- [x] No logic drift from spec

------------------------------------------------------------
COMMIT 02 — Unit tests for scanHelpers [DONE]
------------------------------------------------------------
Commit message:
test(scan): add unit tests for scanHelpers

Tasks:
- [x] Add test file for scanHelpers
- [x] Write tests covering:
  - [x] computeItemFingerprint precedence order
  - [x] updateSessionAttemptCounters 3-fail escalation
  - [x] manualReviewCount reset on safe/unsafe
  - [x] applyUserOverrideToResult remove/add behavior
  - [x] shouldCreateAdminAlert allergen-only rule

Acceptance:
- [x] Tests clearly reference spec sections
- [x] Tests pass locally (28/28 passing)

------------------------------------------------------------
COMMIT 03 — Firestore scan session creation [DONE]
------------------------------------------------------------
Commit message:
feat(scan): create scan session on scan start

Tasks:
- [x] On entering scan flow:
  - [x] Create `scanSessions/{sessionId}` with:
    - attemptCount = 0
    - manualReviewCount = 0
    - escalationShown = false
    - status = "in_progress"
- [x] Store sessionId in scan state

Acceptance:
- [x] Session doc matches spec §2.3
- [x] No attempts written yet

------------------------------------------------------------
COMMIT 04 — Persist scan attempts [DONE]
------------------------------------------------------------
Commit message:
feat(scan): persist scan attempts

Tasks:
- [x] On every scan attempt:
  - [x] Write `attempts/{attemptId}` doc
  - [x] Include:
    - attemptNumber
    - imageHash (if available)
    - ocrText (if available)
    - resultStatus
    - manualReviewReason
    - createdAt

Acceptance:
- [x] Attempts are written even when result is MRR
- [x] attemptNumber increments correctly

------------------------------------------------------------
COMMIT 05 — Write result/latest on every attempt [DONE]
------------------------------------------------------------
Commit message:
feat(scan): persist latest scan result

Tasks:
- [x] After analysis:
  - [x] Write `/result/latest`
  - [x] Always write (including MRR)
  - [x] Include:
    - status
    - manualReviewReason
    - itemName (confirmed > guessed > null)
    - ingredientsExplicit
    - ingredientsInferred
    - profiles
    - createdAt

Acceptance:
- [x] MRR results are persisted
- [x] Data shape matches spec §2.4

------------------------------------------------------------
COMMIT 06 — Implement 3-fail MRR attempt tracking [DONE]
------------------------------------------------------------
Commit message:
feat(scan): implement 3-fail manual review escalation

Tasks:
- [x] Use `updateSessionAttemptCounters`
- [x] Update scanSessions fields:
  - attemptCount
  - manualReviewCount
  - escalationShown
- [x] Surface `shouldShowEscalationMessage` to UI

Acceptance:
- [x] manualReviewCount increments ONLY on MRR
- [x] manualReviewCount resets on safe/unsafe
- [x] Escalation triggers at exactly 3 consecutive MRR

------------------------------------------------------------
COMMIT 07 — Session completion and abandonment [DONE]
------------------------------------------------------------
Commit message:
feat(scan): handle session completion and abandonment

Tasks:
- [x] Mark session as:
  - completed when user leaves results normally
  - abandoned when user exits scan flow mid-session
- [x] Set endedAt timestamp

Acceptance:
- [x] No in-progress sessions left dangling
- [x] Status transitions match spec §3.4

------------------------------------------------------------
COMMIT 08 — History persistence (idempotent) [DONE]
------------------------------------------------------------
Commit message:
feat(history): persist scan history idempotently

Tasks:
- [x] Write `scanHistory/{sessionId}`
- [x] Use sessionId as document ID
- [x] Write history only once per session
- [x] Include MRR results

Acceptance:
- [x] No duplicate history entries
- [x] MRR appears in history list

------------------------------------------------------------
COMMIT 09 — Results UI: verdict header [DONE]
------------------------------------------------------------
Commit message:
feat(results): add verdict header

Tasks:
- [x] Display exactly one of:
  - ✅ Safe
  - ❌ Unsafe
  - 🟡 Manual Review Required
- [x] Verdict is derived from `result/latest.status`

Acceptance:
- [x] Icons and labels match spec exactly
- [x] No extra text or confidence scores

------------------------------------------------------------
COMMIT 10 — Results UI: grouped findings [DONE]
------------------------------------------------------------
Commit message:
feat(results): grouped findings by type

Tasks:
- [x] Render per-profile cards
- [x] Render groups in this order:
  1. ❌ Allergens
  2. ⛔ Preferences
  3. ⚠️ Inferred risks (Not explicitly listed)
- [x] Use plain-language strings only

Acceptance:
- [x] Groups only render if non-empty
- [x] Inferred risks always labeled

------------------------------------------------------------
COMMIT 11 — Manual Review Required UX [DONE]
------------------------------------------------------------
Commit message:
feat(results): manual review dismiss and escalation UX

Tasks:
- [x] Allow dismissing MRR
- [x] Show escalation message after 3 consecutive MRR
- [x] Escalation copy must match spec exactly

Acceptance:
- [x] Dismiss does not delete history
- [x] Escalation only appears once per streak

------------------------------------------------------------
COMMIT 12 — Item fingerprint computation + storage [DONE]
------------------------------------------------------------
Commit message:
feat(scan): compute and store item fingerprint

Tasks:
- [x] Compute fingerprint per spec precedence
- [x] Store fingerprint on:
  - scanSessions/{sessionId}
  - result/latest
- [x] Recompute fingerprint if item name is confirmed later

Acceptance:
- [x] Fingerprint format matches spec §4
- [x] No guessed names used in fingerprint

------------------------------------------------------------
COMMIT 13 — Apply user overrides on scan result [DONE]
------------------------------------------------------------
Commit message:
feat(overrides): apply user overrides to results

Tasks:
- [x] Lookup overrides by `${userId}_${itemFingerprint}`
- [x] Apply overridePayload using helper
- [x] Mark corrected findings as source=user_corrected
- [x] Show "Corrected by you" badge

Acceptance:
- [x] Overrides apply immediately
- [x] Only affect the correcting user

------------------------------------------------------------
COMMIT 14 — Correct this result flow [DONE]
------------------------------------------------------------
Commit message:
feat(corrections): user correction flow

Tasks:
- [x] Add "Correct this result" action
- [x] Persist correction doc:
  - before
  - after
  - sessionId
  - itemFingerprint
- [x] Persist override doc
- [x] Show thank-you message

Acceptance:
- [x] Thank-you shown exactly once per correction
- [x] Correction is logged and applied locally

------------------------------------------------------------
COMMIT 15 — Inference escalation logic [DONE]
------------------------------------------------------------
Commit message:
feat(inference): escalate inferred severe allergens

Tasks:
- [x] Maintain allowlist of "very bad allergies"
- [x] If inferred risk matches:
  - duplicate/move to ❌ Allergens
  - set escalatedFromInferred=true
  - set profile verdict = unsafe

Acceptance:
- [x] Escalation changes overall verdict
- [x] Escalated items appear in ❌ group

------------------------------------------------------------
COMMIT 16 — Admin alert creation (allergen only) [DONE]
------------------------------------------------------------
Commit message:
feat(alerts): create allergen-only admin alerts

Tasks:
- [x] Use `shouldCreateAdminAlert`
- [x] Create alert only if allergen involved
- [x] Never alert for preferences-only or MRR-only

Acceptance:
- [x] Alerts include plain-language summary
- [x] Alerts target admin/co-admin only

------------------------------------------------------------
COMMIT 17 — Alerts UI [DONE]
------------------------------------------------------------
Commit message:
feat(alerts): admin alert list UI

Tasks:
- [x] List allergen alerts
- [x] Mark alerts as read
- [x] Show summary text only

Acceptance:
- [x] No alerts for preferences
- [x] Clear, plain-language display

------------------------------------------------------------
COMMIT 18 — Final verification [DONE]
------------------------------------------------------------
Commit message:
chore: final verification and cleanup

Tasks:
- [x] Run lint, typecheck, tests
- [x] Remove debug logs
- [x] Verify acceptance criteria §9
- [x] Update TASKS.md marking all commits complete

Acceptance:
- [x] All tests passing (28/28)
- [x] No spec violations
- [x] App ready for PR review

Note: Pre-existing TypeScript errors exist in files not touched by this work
(LoginScreen, SignupScreen, FamilyProfilesScreen, allergenDatabase, etc.).
These are unrelated to the scan session implementation.
