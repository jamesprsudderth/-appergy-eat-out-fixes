```md
# Appergy Scanner — VISION.md
*“Scan. Analyze. Eat with Confidence.”*  
**Date:** February 20, 2026  
**Status:** Production-ready build spec + Autonomous Agent build charter

---

## 0) What this document is
This is the single source of truth for building **Appergy Scanner** into a **launch-ready iOS + Android app**, using an **Autonomous Agent workflow inside ChatGPT + Codex + Cursor/VS Code + GitHub PRs**.

**Primary outcome:** a safe, fast, subscription-gated mobile app that helps users with allergies and dietary restrictions **scan grocery items / food packaging / ingredients lists / barcodes** and get **clear, actionable results** with **manual review fallbacks**.

**Safety posture:** This is a **decision-support tool**, not medical advice. AI can be wrong. The app must be designed to **fail closed** whenever uncertain.

---

## 1) North Star
### Vision Statement
Build the most trusted, fastest “food safety scanning” companion for people with allergies and dietary constraints—especially families—so they can confidently shop, order, and eat without guesswork.

### Core Promise
- “Never guess again. Know before you buy, order, or eat.”
- Results are **glanceable and honest**: **✅ Safe / ❌ Unsafe / 🟡 Manual Review Required**
- The app never pretends certainty. If confidence is low, it **forces safer behavior**.

### Non-goals
- Not a social network.
- Not ad-driven.
- Not a weight-loss or nutrition coach.
- No claims of 100% accuracy.

---

## 2) Target Users & Use Cases
### Primary personas
1. **Parents/caregivers managing a child’s severe allergy** (highest stakes; frequent scanning).
2. **Adults with multiple restrictions** (needs customization + clarity).
3. **Families on the go** (admin + dependents, profile-based analysis).

### Primary scenarios
- Grocery aisle: scan **barcode** OR take a photo of the **ingredients list**.
- Home pantry: scan packaging/ingredients for safety checks.
- Eating out (optional/Phase 2): use location + Places to shortlist restaurants; still conservative.
- Ongoing management: scan history, re-scan, corrections, exports.

---

## 3) Product Principles (Non-negotiable)
1. **Fail closed:** uncertainty → Manual Review Required.
2. **No silent failures:** every save, scan, and API call has visible success/failure states.
3. **No exposed secrets:** OpenAI + Places keys never ship to the client.
4. **High trust UX:** calm, minimal, accessible; warnings are explicit and consistent.
5. **Family safety first:** dependent alerts happen **only** for relevant risk (e.g., contains allergen).
6. **Accuracy > cleverness:** avoid features that reduce reliability.

---

## 4) Must-Have Features (V1)
### 4.1 Auth + Legal
- Firebase Auth: Email/password + Google Sign-In.
- Signup requires acceptance of:
  - Terms of Service
  - Privacy Policy
  - “Not medical advice / verify manually” disclaimer
- Account deletion with data purge path.

### 4.2 Profiles (Single + Family)
- User has a **main profile** (self) and optional **family profiles** (up to plan limit).
- Each profile includes:
  - Name
  - Allergies (multi-select + custom)
  - Preferences (multi-select + custom)
- Roles:
  - Admin can manage family profiles.
  - Members can view their own profile + scan results (policy can vary by plan).

### 4.3 Scanning (Core of the product)
The scan entry point must be named:
- **“Scan Packaging / Ingredients List”**  
Not “Scan Food Label,” and do not imply menu scanning in that default flow.

#### Scan Modes
1) **Barcode Scan**
   - Uses the barcode overlay UI (this is the only mode with a barcode frame).
   - Lookup via Open Food Facts (or equivalent UPC/ingredient dataset).
2) **Packaging / Ingredients Photo**
   - Full-screen camera capture (no barcode overlay).
   - Must include a visible **Capture Photo** button.
   - AI vision extraction handled server-side via secure proxy.

#### Confidence rule (hard requirement)
- If confidence < **0.80**, outcome is **Manual Review Required** by default.
- Manual review includes explicit prompts + safe fallback actions.

### 4.4 Results UX (Glanceable + Explainable)
- Render per-profile result cards:
  - ✅ Safe
  - ❌ Unsafe
  - 🟡 Manual Review Required
- Findings grouped by type:
  - ❌ Allergens
  - ⛔ Preferences
  - ⚠️ Inferred risks (“Not explicitly listed”)

Each finding includes:
- Ingredient/term
- Why it was flagged
- Severity (low/medium/high)
- Explicit vs inferred indicator (separate symbol)

#### Manual Review behavior
- User can dismiss once.
- If user repeats scans and results are still not reliable:
  - After **3 failed attempts**, escalate message:
    - “Our apologies — our goal is to keep you safe. Please double-check the label or enter ingredients manually.”

#### Correction feedback loop
- “Correct this result”
  - Captures user correction and stores an override.
  - Shows gratitude (“Thanks for helping…”) and saves feedback safely.
  - Must not store raw sensitive OCR text in logs.

### 4.5 History
- Every scan is saved in production (no exceptions).
- Filter/search by:
  - date
  - profile/person
  - verdict
  - allergens/preferences/inferred
- Re-open a past scan, re-run analysis, share/export.

### 4.6 Subscription Gating (RevenueCat)
- Subscription-first product.
- RevenueCat entitlements gate:
  - unlimited scans
  - family profile count
  - exports/sharing (if paid-only)
  - advanced features (eat-out, etc.)
- **No mock/demo mode in production**. Any mock must hard-fail in prod builds.

### 4.7 Exports + Sharing (V1 or near-V1)
- Users can export a “safety profile report” as PDF.
- Sharing via QR code that links to said PDF.
- User controls how long the shared export is accessible (time-limited link).
- If subscription lapses:
  - user cannot access their profile
  - shared profile access expires / becomes inaccessible

### 4.8 Eat Out (Phase 2 / V1.5)
- Google Places nearby restaurants (location-permission gated).
- Filters based on profiles/preferences.
- Safety messaging remains conservative.

---

## 5) UI/UX Rules (Strict)
### Design tone
Calm, clean, safety-tool aesthetic. Zero clutter.

### Interaction rules
- Tap targets: minimum 48dp.
- Back button top-left on non-tab screens.
- Consistent states:
  - Loading / skeleton
  - Success confirmation
  - Error with retry
- Haptics:
  - success
  - warning
  - unsafe
- Accessibility:
  - VoiceOver labels
  - Dynamic type
  - Never rely on color alone (use icons + labels)

### Scan screen rules
- **Barcode mode:** show scanning frame overlay.
- **Ingredients photo mode:** full-screen preview + capture button.
- Always allow:
  - retake
  - permission prompts
  - graceful failure + fallback

### Disclaimers (everywhere it matters)
- Banner on results screen:
  - “AI can make mistakes. Always verify labels.”
- Manual Review screen must be explicit and action-oriented.

---

## 6) Tech Stack (Locked)
### Mobile
- React Native + Expo (managed)
- Navigation: @react-navigation (bottom tabs + stack)
- Camera:
  - barcode scanning (Expo-supported)
  - photo capture for ingredients
- Image preprocessing: expo-image-manipulator (resize/compress)
- Haptics: expo-haptics
- Location: expo-location (eat out feature)

### Backend / Data
- Firebase:
  - Auth
  - Firestore
  - Cloud Functions (OpenAI proxy + business logic)
  - Analytics (no opt-out analytics per current requirement)
  - Crash reporting recommended

### AI
- OpenAI via server-side proxy only (Cloud Functions)
- Vision extraction + analysis produces strict JSON

### Payments
- RevenueCat (react-native-purchases)
- Server-side validation recommended (verify entitlements)

### External APIs
- Google Places (eat out)
- Open Food Facts (barcode lookup / ingredients)

---

## 7) Architecture
### Suggested repo structure
```

src/
screens/
components/
navigation/
contexts/
services/
firebase.ts
revenuecat.ts
ai.ts
places.ts
openfoodfacts.ts
analytics.ts
constants/
allergens.ts
preferences.ts
disclaimers.ts
theme.ts
utils/
imageCompressor.ts
resultMapping.ts
types/

````

### System design overview
**Client (Expo app)**  
→ capture image or barcode  
→ preprocess (resize/compress)  
→ call Cloud Function endpoint  
→ receive strict JSON analysis  
→ render results + save scan history  
→ gate features via RevenueCat entitlements

**Cloud Functions (Proxy + policy)**  
→ require auth  
→ enforce rate limits  
→ call OpenAI / Places / OFF securely  
→ return normalized schema  
→ log only safe metadata (never PII / OCR text / images / tokens)

---

## 8) Firestore Data Model
### Users
`users/{uid}`
```ts
{
  email: string,
  createdAt: Timestamp,
  mainProfile: {
    name: string,
    allergies: string[],
    preferences: string[],
    photoURL?: string
  },
  familyProfiles: Array<{
    id: string,
    name: string,
    allergies: string[],
    preferences: string[],
    role: "admin" | "member"
  }>,
  subscription: {
    status: "active" | "inactive" | "grace" | "expired",
    plan: "individual" | "family",
    expiresAt?: Timestamp,
    entitlementIds?: string[]
  }
}
````

### Scan history

`users/{uid}/scanHistory/{scanId}`

```ts
{
  createdAt: Timestamp,
  mode: "barcode" | "ingredients_photo" | "menu_text",
  source: {
    upc?: string,
    imageRef?: string,
    placeId?: string
  },
  extracted: {
    ingredients: string[],
    traces?: string[],
    mayContain?: string[]
  },
  analysis: Array<{
    personId: string,
    personName: string,
    verdict: "safe" | "unsafe" | "manual_review",
    severity: "low" | "medium" | "high",
    findings: Array<{
      type: "allergen" | "preference" | "inferred_risk",
      label: string,
      reason: string,
      explicit: boolean
    }>
  }>,
  overall: {
    confidence: number,
    summary: string
  },
  feedback?: {
    corrected: boolean,
    notes?: string
  }
}
```

### Security rules (principle)

* Strict UID isolation: users can only access their own docs.
* Cloud Functions must require auth for protected routes.
* No cross-user access.

---

## 9) AI Contract (Strict JSON)

### Required response schema

```json
{
  "extracted": {
    "ingredients": ["string"],
    "traces": ["string"],
    "mayContain": ["string"]
  },
  "analysis": [
    {
      "personName": "string",
      "verdict": "safe|unsafe|manual_review",
      "severity": "low|medium|high",
      "findings": [
        {
          "type": "allergen|preference|inferred_risk",
          "label": "string",
          "reason": "string",
          "explicit": true
        }
      ]
    }
  ],
  "overall": {
    "confidence": 0.0,
    "summary": "string"
  }
}
```

### Confidence + fail-closed policy

* If `overall.confidence < 0.80`, all persons default to `manual_review` unless a clear `unsafe` is detected.
* If an inferred ingredient matches a high-severity allergy, escalate:

  * verdict becomes `unsafe` OR `manual_review` with `high` severity depending on explicitness; never “safe”.

### Prompting rules (proxy)

* JSON only (no prose).
* Must separate explicit vs inferred ingredients.
* Must avoid medical advice phrasing.
* Must be conservative.

---

## 10) Analytics (Current requirement)

* No opt-out analytics requirement is in effect.
* Track only non-sensitive events:

  * `signup_completed`
  * `onboarding_completed`
  * `scan_started`
  * `scan_completed`
  * `scan_manual_review`
  * `scan_unsafe`
  * `subscription_started`
  * `subscription_renewed`
  * `export_created`
* Never log:

  * raw OCR text
  * images
  * tokens/keys

---

## 11) Known Issues / Production Blockers (Priority)

1. Firebase/Firestore integration must be fully reliable:

   * onboarding saves must never silently fail
   * scan saves must always succeed (or show error + retry)
2. Google Places integration must be configured correctly (if enabled).
3. Scan UX must be correct:

   * rename “Scan Food Label” → “Scan Packaging / Ingredients List”
   * barcode overlay only in barcode mode
   * add capture button for photo scanning
4. OpenAI integration must be secure and robust:

   * server proxy only
   * strict JSON
   * confidence threshold behavior
5. Manual entry fallback must exist and trigger when confidence < 0.80.
6. Any mock/demo mode must hard-fail in production.

---

## 12) Engineering Rules for Autonomous Agents

### Definition of Done (DoD)

A feature is “done” only when:

* Works on iOS + Android dev builds
* Errors are handled and user-visible
* Firestore writes are verified
* No keys leak to the client
* Lint + types + tests pass

### Work discipline

* Implement in strict priority order:

  * P0 security/safety correctness
  * then reliability
  * then features/polish
* One PR-worthy commit per backlog item:

  * `SAFE-1: fail-closed manual review under 0.80 confidence`
* Minimal diffs. No unrelated refactors.

### Safety logging rules (hard)

* Never log PII.
* Never log OCR ingredient text.
* Never log images.
* Never log tokens/keys.

### Testing commands (per item)

* `npm run lint`
* `npm run check:types`
* `npm test`

---

## 13) Autonomous Agent Builder Requirements (ChatGPT-native workflow)

The agent workflow must:

1. Treat this VISION as a contract.
2. Plan work as a backlog with priorities and acceptance criteria.
3. Generate implementation steps and code changes in small increments.
4. Enforce non-negotiables:

   * fail-closed
   * confidence threshold
   * no key leakage
   * no silent failures
5. Maintain a running checklist of:

   * completed items
   * files changed per item
   * commands run + results
6. Support multi-agent workflow:

   * Planner (architecture + tickets)
   * Implementer (code changes)
   * Reviewer/Auditor (security + correctness)
   * QA (flows + regression)

### Agent output format (every cycle)

* ✅ Goal of the change
* 🧩 Files to edit
* 🔧 Implementation steps
* 🧪 Tests to run + expected result
* 🧯 Edge cases + failure modes
* 📌 Acceptance criteria checklist

---

## 14) Launch Checklist (Minimum viable launch)

* Auth + onboarding complete and persist correctly.
* Scanning works:

  * barcode lookup
  * ingredients photo capture → AI proxy → JSON → results
* Confidence < 0.80 enforced (manual review + fallbacks).
* History saves 100% reliably.
* RevenueCat gating works end-to-end.
* No demo/mock code in prod builds.
* Privacy/ToS/disclaimer flows correct.
* Crash + error monitoring enabled.
* Store metadata ready:

  * screenshots
  * privacy labels
  * subscription disclosures

---

## 15) Roadmap

### Phase 1 (Production blockers)

* Firestore reliability
* OpenAI proxy + JSON contract + confidence policy
* Scan UX correctness + manual fallback

### Phase 2 (Core completeness)

* Family profiles + dependent alert logic
* History filtering/search
* Corrections feedback loop

### Phase 3 (Expansion)

* Eat Out (Google Places)
* Exports (PDF + QR + expiry)
* Partnerships + credibility building

---

## 16) Final note (tone + purpose)

Appergy exists to reduce anxiety and prevent harm. The app must always choose the safer path when uncertain, communicate clearly, and earn trust through consistency.

```
::contentReference[oaicite:0]{index=0}
```
