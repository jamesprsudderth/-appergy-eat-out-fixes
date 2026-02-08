# scanHelpers.ts — Implementation Spec

Paste into:
`src/services/scanHelpers.ts`

This file is the **single source of truth** for:

- Item fingerprinting
- 3-fail MRR attempt tracking
- User override application
- Admin alert eligibility

Must comply with:
- docs/scan-state-machine-firestore-model-results-ux.md

The full TypeScript implementation is approved and must not be modified without spec update.