# Appergy Scanner — Scan State Machine + Firestore Model + Results UX

Version: 1.0  
Owner: James  
Scope: Scan → Analyze → Results → History → Corrections → Alerts

---

## 1. Scan State Machine

### States
- in_progress
- completed
- abandoned

### Session Start
- Create scanSessions/{sessionId}
- attemptCount = 0
- manualReviewCount = 0
- escalationShown = false

### On Each Attempt
1. attemptCount++
2. If resultStatus == manual_review_required:
   - manualReviewCount++
   - If manualReviewCount ≥ 3 and escalationShown == false:
     - show escalation message
     - escalationShown = true
3. Else:
   - manualReviewCount = 0
   - escalationShown = false
4. Always write:
   - attempt doc
   - result/latest
   - scanHistory (idempotent)

### Edge Cases
- Profile change → abandon session, start new
- Rescan → same session
- Exit scan → mark abandoned
- Dismiss MRR → still saved

---

## 2. Firestore Model

All documents live under:

`accounts/{accountId}/...`

### Scan Sessions
`scanSessions/{sessionId}`

- initiatedByUserId
- scanType
- selectedProfileIds
- attemptCount
- manualReviewCount
- escalationShown
- itemNameGuess
- itemNameConfirmed
- itemFingerprint
- status
- createdAt
- endedAt

### Attempts
`scanSessions/{sessionId}/attempts/{attemptId}`

- attemptNumber
- imageHash
- ocrText
- resultStatus
- manualReviewReason
- createdAt

### Result (Latest)
`scanSessions/{sessionId}/result/latest`

- status
- manualReviewReason
- itemName
- itemFingerprint
- ingredientsExplicit
- ingredientsInferred
- profiles
- createdAt

### History (Idempotent)
`scanHistory/{sessionId}`

- sessionId
- itemName
- status
- manualReviewReason
- selectedProfileIds
- createdAt

---

## 3. Results UI Contract

### Always Visible
- Verdict header (✅ ❌ 🟡)

### Findings (per profile)
- ❌ Allergens
- ⛔ Preferences
- ⚠️ Inferred risks (Not explicitly listed)

### Actions
- Rescan
- Confirm item name
- Correct this result

---

## 4. Admin Alerts (LOCKED)

Trigger alert ONLY if:
- allergens.length > 0
- OR inferred risk escalatedFromInferred == true

Never trigger for:
- preferences only
- MRR without allergen evidence

---

## 5. Acceptance Criteria
- MRR saved and dismissible
- 3-fail escalation message
- Inferred risks labeled
- Inferred severe escalates
- Corrections persist
- Alerts allergen-only