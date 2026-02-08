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
COMMIT 01 — Add scanHelpers.ts (core logic)
------------------------------------------------------------
Commit message:
feat(scan): add scanHelpers core logic

Tasks:
- Create `src/services/scanHelpers.ts`
- Paste the full approved implementation exactly as specified
- Export all helper functions
- Do NOT change logic or behavior

Acceptance:
- File compiles
- No unused exports
- No logic drift from spec

------------------------------------------------------------
COMMIT 02 — Unit tests for scanHelpers
------------------------------------------------------------
Commit message:
test(scan): add unit tests for scanHelpers

Tasks:
- Add test file for scanHelpers
- Write tests covering:
  - computeItemFingerprint precedence order
  - updateSessionAttemptCounters 3-fail escalation
  - manualReviewCount reset on safe/unsafe
  - applyUserOverrideToResult remove/add behavior
  - shouldCreateAdminAlert allergen-only rule

Acceptance:
- Tests clearly reference spec sections
- Tests pass locally

------------------------------------------------------------
COMMIT 03 — Firestore scan session creation
------------------------------------------------------------
Commit message:
feat(scan): create scan session on scan start

Tasks:
- On entering scan flow:
  - Create `scanSessions/{sessionId}` with:
    - attemptCount = 0
    - manualReviewCount = 0
    - escalationShown = false
    - status = "in_progress"
- Store sessionId in scan state

Acceptance:
- Session doc matches spec §2.3
- No attempts written yet

------------------------------------------------------------
COMMIT 04 — Persist scan attempts
------------------------------------------------------------
Commit message:
feat(scan): persist scan attempts

Tasks:
- On every scan attempt:
  - Write `attempts/{attemptId}` doc
  - Include:
    - attemptNumber
    - imageHash (if available)
    - ocrText (if available)
    - resultStatus
    - manualReviewReason
    - createdAt

Acceptance:
- Attempts are written even when result is MRR
- attemptNumber increments correctly

------------------------------------------------------------
COMMIT 05 — Write result/latest on every attempt
------------------------------------------------------------
Commit message:
feat(scan): persist latest scan result

Tasks:
- After analysis:
  - Write `/result/latest`
  - Always write (including MRR)
  - Include:
    - status
    - manualReviewReason
    - itemName (confirmed > guessed > null)
    - ingredientsExplicit
    - ingredientsInferred
    - profiles
    - createdAt

Acceptance:
- MRR results are persisted
- Data shape matches spec §2.4

------------------------------------------------------------
COMMIT 06 — Implement 3-fail MRR attempt tracking
------------------------------------------------------------
Commit message:
feat(scan): implement 3-fail manual review escalation

Tasks:
- Use `updateSessionAttemptCounters`
- Update scanSessions fields:
  - attemptCount
  - manualReviewCount
  - escalationShown
- Surface `shouldShowEscalationMessage` to UI

Acceptance:
- manualReviewCount increments ONLY on MRR
- manualReviewCount resets on safe/unsafe
- Escalation triggers at exactly 3 consecutive MRR

------------------------------------------------------------
COMMIT 07 — Session completion and abandonment
------------------------------------------------------------
Commit message:
feat(scan): handle session completion and abandonment

Tasks:
- Mark session as:
  - completed when user leaves results normally
  - abandoned when user exits scan flow mid-session
- Set endedAt timestamp

Acceptance:
- No in-progress sessions left dangling
- Status transitions match spec §3.4

------------------------------------------------------------
COMMIT 08 — History persistence (idempotent)
------------------------------------------------------------
Commit message:
feat(history): persist scan history idempotently

Tasks:
- Write `scanHistory/{sessionId}`
- Use sessionId as document ID
- Write history only once per session
- Include MRR results

Acceptance:
- No duplicate history entries
- MRR appears in history list

------------------------------------------------------------
COMMIT 09 — Results UI: verdict header
------------------------------------------------------------
Commit message:
feat(results): add verdict header

Tasks:
- Display exactly one of:
  - ✅ Safe
  - ❌ Unsafe
  - 🟡 Manual Review Required
- Verdict is derived from `result/latest.status`

Acceptance:
- Icons and labels match spec exactly
- No extra text or confidence scores

------------------------------------------------------------
COMMIT 10 — Results UI: grouped findings
------------------------------------------------------------
Commit message:
feat(results): grouped findings by type

Tasks:
- Render per-profile cards
- Render groups in this order:
  1. ❌ Allergens
  2. ⛔ Preferences
  3. ⚠️ Inferred risks (Not explicitly listed)
- Use plain-language strings only

Acceptance:
- Groups only render if non-empty
- Inferred risks always labeled

------------------------------------------------------------
COMMIT 11 — Manual Review Required UX
------------------------------------------------------------
Commit message:
feat(results): manual review dismiss and escalation UX

Tasks:
- Allow dismissing MRR
- Show escalation message after 3 consecutive MRR
- Escalation copy must match spec exactly

Acceptance:
- Dismiss does not delete history
- Escalation only appears once per streak

------------------------------------------------------------
COMMIT 12 — Item fingerprint computation + storage
------------------------------------------------------------
Commit message:
feat(scan): compute and store item fingerprint

Tasks:
- Compute fingerprint per spec precedence
- Store fingerprint on:
  - scanSessions/{sessionId}
  - result/latest
- Recompute fingerprint if item name is confirmed later

Acceptance:
- Fingerprint format matches spec §4
- No guessed names used in fingerprint

------------------------------------------------------------
COMMIT 13 — Apply user overrides on scan result
------------------------------------------------------------
Commit message:
feat(overrides): apply user overrides to results

Tasks:
- Lookup overrides by `${userId}_${itemFingerprint}`
- Apply overridePayload using helper
- Mark corrected findings as source=user_corrected
- Show “Corrected by you” badge

Acceptance:
- Overrides apply immediately
- Only affect the correcting user

------------------------------------------------------------
COMMIT 14 — Correct this result flow
------------------------------------------------------------
Commit message:
feat(corrections): user correction flow

Tasks:
- Add “Correct this result” action
- Persist correction doc:
  - before
  - after
  - sessionId
  - itemFingerprint
- Persist override doc
- Show thank-you message

Acceptance:
- Thank-you shown exactly once per correction
- Correction is logged and applied locally

------------------------------------------------------------
COMMIT 15 — Inference escalation logic
------------------------------------------------------------
Commit message:
feat(inference): escalate inferred severe allergens

Tasks:
- Maintain allowlist of “very bad allergies”
- If inferred risk matches:
  - duplicate/move to ❌ Allergens
  - set escalatedFromInferred=true
  - set profile verdict = unsafe

Acceptance:
- Escalation changes overall verdict
- Escalated items appear in ❌ group

------------------------------------------------------------
COMMIT 16 — Admin alert creation (allergen only)
------------------------------------------------------------
Commit message:
feat(alerts): create allergen-only admin alerts

Tasks:
- Use `shouldCreateAdminAlert`
- Create alert only if allergen involved
- Never alert for preferences-only or MRR-only

Acceptance:
- Alerts include plain-language summary
- Alerts target admin/co-admin only

------------------------------------------------------------
COMMIT 17 — Alerts UI
------------------------------------------------------------
Commit message:
feat(alerts): admin alert list UI

Tasks:
- List allergen alerts
- Mark alerts as read
- Show summary text only

Acceptance:
- No alerts for preferences
- Clear, plain-language display

------------------------------------------------------------
COMMIT 18 — Final verification
------------------------------------------------------------
Commit message:
chore: final verification and cleanup

Tasks:
- Run lint, typecheck, tests
- Remove debug logs
- Verify acceptance criteria §9
- Update TASKS.md marking all commits complete

Acceptance:
- All tests passing
- No spec violations
- App ready for PR review

------------------------------------------------------------
BLOCKERS
------------------------------------------------------------
If blocked:
- Describe exact error
- File + line number
- What is missing
- What decision is required