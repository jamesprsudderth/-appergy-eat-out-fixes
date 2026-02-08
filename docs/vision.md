# Appergy Scanner — Product Vision

Owner: James  
Version: 1.0  
Last Updated: 2026-02-07

## Mission
Appergy Scanner exists to help people with food allergies and dietary preferences make safer decisions by scanning food labels, menus, and products — without guessing when information is uncertain.

## Core Promise
Every scan returns a **clear, honest verdict**:

- ✅ Safe
- ❌ Unsafe
- 🟡 Manual Review Required

If Appergy cannot confidently determine safety, it must abstain and require manual verification.

## Target Users
1. Individuals with food allergies
2. Families managing multiple profiles (children, dependents)
3. Users with dietary preferences (vegan, gluten-free, etc.)
4. Caregivers and admins monitoring dependent scans

## Non-Negotiable Principles (LOCKED)
1. **Safety-first abstention**
   - Low OCR or analysis confidence → 🟡 Manual Review Required
   - MRR is dismissible
   - MRR scans are always saved to history

2. **Inference is allowed, but labeled**
   - Inferred items appear under ⚠️ *Inferred risks (Not explicitly listed)*
   - Inferred risks that match a *very bad allergy* escalate to ❌ Unsafe

3. **Plain-language output**
   - Findings are simple statements (“Contains peanuts”)
   - No technical jargon or confidence scores shown to users

4. **User correction loop**
   - Users can correct results
   - Corrections apply immediately via local overrides
   - Corrections are logged for investigation
   - Show thank-you confirmation after correction

5. **Repeated failure escalation**
   - After 3 consecutive MRR results in the same scan session:
     “Our apologies. Our goal is to keep you safe. Please double-check this item manually.”

6. **Admin alerts (allergen only)**
   - Alerts trigger only when allergens are involved
   - Never alert for preferences-only conflicts

## MVP Scope
- Camera scanning (labels, menus, barcode, general)
- Scan session tracking with 3-fail MRR escalation
- Item fingerprinting for overrides
- Results UI with grouped findings
- Scan history (including MRR)
- User corrections + overrides
- Admin alerts (allergen only)

## Out of Scope (Post-MVP)
- PDF/QR exports
- Public API access
- Grocery shopping integrations