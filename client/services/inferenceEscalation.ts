/*
 * Inference Escalation Service
 *
 * Spec §4: Inferred risks that match a "very bad allergy" escalate to ❌ Unsafe.
 *
 * - Maintain allowlist of "very bad allergies"
 * - If inferred risk matches:
 *   - Duplicate/move to ❌ Allergens
 *   - Set escalatedFromInferred = true
 *   - Set profile verdict = unsafe
 */

import { type ProfileResult, type SafetyStatus } from "@/services/ai";

/**
 * "Very bad allergy" allowlist.
 * These allergens, when inferred (not explicitly listed),
 * still escalate the result to ❌ Unsafe.
 */
export const VERY_BAD_ALLERGIES = [
  "peanuts",
  "tree nuts",
  "shellfish",
  "fish",
  "milk",
  "eggs",
  "wheat",
  "soy",
  "sesame",
];

export interface InferredRisk {
  name: string;
  escalatedFromInferred: boolean;
}

/**
 * Check if an inferred risk matches a "very bad allergy".
 */
export function isVeryBadAllergy(inferredRisk: string): boolean {
  const lower = inferredRisk.toLowerCase();
  return VERY_BAD_ALLERGIES.some(
    (allergy) =>
      lower.includes(allergy) || allergy.includes(lower),
  );
}

/**
 * Escalate inferred severe allergens in profile results.
 * - Moves matching inferred risks to matchedAllergens
 * - Sets status to "unsafe" if escalated
 * - Returns escalation metadata
 */
export function escalateInferredRisks(
  results: ProfileResult[],
  inferredRisks: string[],
): {
  results: ProfileResult[];
  escalatedItems: InferredRisk[];
} {
  const escalatedItems: InferredRisk[] = [];

  const updatedResults = results.map((result) => {
    const escalatedAllergens: string[] = [];
    const remainingInferred: string[] = [];

    for (const risk of inferredRisks) {
      if (isVeryBadAllergy(risk)) {
        escalatedAllergens.push(risk);
        escalatedItems.push({
          name: risk,
          escalatedFromInferred: true,
        });
      } else {
        remainingInferred.push(risk);
      }
    }

    if (escalatedAllergens.length === 0) return result;

    const newStatus: SafetyStatus = "unsafe";
    return {
      ...result,
      matchedAllergens: [
        ...result.matchedAllergens,
        ...escalatedAllergens,
      ],
      status: newStatus,
      safe: false,
      reasons: [
        ...result.reasons,
        ...escalatedAllergens.map(
          (a) => `Inferred risk escalated: may contain ${a}`,
        ),
      ],
    };
  });

  return {
    results: updatedResults,
    escalatedItems,
  };
}
