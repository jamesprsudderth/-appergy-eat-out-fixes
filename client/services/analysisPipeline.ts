/*
 * Analysis Pipeline
 *
 * Bridges AI text extraction (OCR) with the deterministic policy engine.
 * 
 * Flow:
 *   1. AI/OCR extracts raw text from image
 *   2. Ingredient normalizer parses text into structured tokens
 *   3. Policy engine checks against user profile (deterministic)
 *   4. Results formatted for UI (backward-compatible with existing screens)
 *
 * This module can be used both:
 *   - Client-side (with text already extracted)
 *   - Server-side (after OCR step)
 */

import { parseIngredientLabel, ParsedLabel } from "./ingredientNormalizer";
import {
  evaluateLabelForProfiles,
  PolicyResult,
  Finding,
  UserProfile,
} from "./policyEngine";
import type {
  AnalysisResult,
  ProfileResult,
  MatchedIngredient,
  SafetyStatus,
  ProfileInfo,
} from "./ai";

// ─── Main Pipeline Functions ───

/**
 * Analyze raw ingredient text against profiles using the deterministic engine.
 * Use this when you already have extracted text (from OCR or manual input).
 */
export function analyzeIngredientsText(
  rawText: string,
  profiles: ProfileInfo[]
): AnalysisResult {
  // Step 1: Parse the ingredient label
  const parsedLabel = parseIngredientLabel(rawText);

  // Step 2: Convert ProfileInfo → UserProfile for the engine
  const userProfiles: UserProfile[] = profiles.map(profileInfoToUserProfile);

  // Step 3: Run deterministic policy engine
  const policyResults = evaluateLabelForProfiles(parsedLabel, userProfiles);

  // Step 4: Convert to existing AnalysisResult format for UI compatibility
  return policyResultsToAnalysisResult(parsedLabel, policyResults);
}

/**
 * Enhanced analysis result that includes evidence spans and parsed label.
 * Screens can use this for rich highlighting.
 */
export interface EnhancedAnalysisResult extends AnalysisResult {
  /** The parsed label with section boundaries */
  parsedLabel: ParsedLabel;
  /** Full policy results with evidence spans per profile */
  policyResults: PolicyResult[];
  /** Overall confidence across all profiles */
  confidence: number;
  /** Warnings about data quality */
  dataQualityFlags: string[];
}

/**
 * Enhanced version that returns richer data for the new UI.
 */
export function analyzeIngredientsTextEnhanced(
  rawText: string,
  profiles: ProfileInfo[]
): EnhancedAnalysisResult {
  const parsedLabel = parseIngredientLabel(rawText);
  const userProfiles = profiles.map(profileInfoToUserProfile);
  const policyResults = evaluateLabelForProfiles(parsedLabel, userProfiles);
  const baseResult = policyResultsToAnalysisResult(parsedLabel, policyResults);

  // Compute data quality flags
  const dataQualityFlags: string[] = [];
  if (parsedLabel.ingredients.length === 0) {
    dataQualityFlags.push("No ingredients could be parsed from the text");
  }
  if (parsedLabel.ingredients.length < 3) {
    dataQualityFlags.push(
      "Very few ingredients detected — text may be incomplete"
    );
  }
  if (parsedLabel.mayContainStatements.length > 0) {
    dataQualityFlags.push(
      "Label includes 'may contain' warnings — cross-contamination risk"
    );
  }

  const confidence =
    policyResults.length > 0
      ? Math.min(...policyResults.map((r) => r.confidence))
      : 1.0;

  return {
    ...baseResult,
    parsedLabel,
    policyResults,
    confidence,
    dataQualityFlags,
  };
}

// ─── Conversion Helpers ───

/**
 * Convert ProfileInfo (existing format) → UserProfile (engine format).
 */
function profileInfoToUserProfile(profile: ProfileInfo): UserProfile {
  return {
    id: profile.id,
    name: profile.name,
    allergies: profile.allergies || [],
    preferences: profile.preferences || [],
    forbiddenKeywords: profile.forbiddenKeywords || [],
    treatMayContainAsUnsafe: false, // default; could be a user setting
  };
}

/**
 * Convert PolicyResult[] → AnalysisResult (backward-compatible).
 */
function policyResultsToAnalysisResult(
  parsedLabel: ParsedLabel,
  policyResults: PolicyResult[]
): AnalysisResult {
  const matchedIngredients: MatchedIngredient[] = [];

  const results: ProfileResult[] = policyResults.map((pr) => {
    const matchedAllergens: string[] = [];
    const matchedKeywords: string[] = [];
    const matchedPreferences: string[] = [];
    const reasons: string[] = [];

    for (const finding of pr.findings) {
      reasons.push(finding.reason);

      switch (finding.kind) {
        case "ALLERGEN":
          matchedAllergens.push(finding.matchedText);
          addMatchedIngredient(
            matchedIngredients,
            finding.matchedText,
            "allergen",
            pr.profileId
          );
          break;
        case "DIETARY":
          matchedPreferences.push(
            `${finding.canonicalTerm}: ${finding.matchedText}`
          );
          addMatchedIngredient(
            matchedIngredients,
            finding.matchedText,
            "preference",
            pr.profileId
          );
          break;
        case "FORBIDDEN_KEYWORD":
          matchedKeywords.push(finding.matchedText);
          addMatchedIngredient(
            matchedIngredients,
            finding.matchedText,
            "keyword",
            pr.profileId
          );
          break;
      }
    }

    // Map policy status to existing SafetyStatus type
    let status: SafetyStatus;
    switch (pr.status) {
      case "UNSAFE":
        status = "unsafe";
        break;
      case "CAUTION":
        status = "caution";
        break;
      default:
        status = "safe";
    }

    return {
      profileId: pr.profileId,
      name: pr.profileName,
      safe: pr.status === "SAFE",
      status,
      reasons,
      matchedAllergens,
      matchedKeywords,
      matchedPreferences,
    };
  });

  return {
    ingredients: parsedLabel.ingredients,
    results,
    matchedIngredients,
  };
}

function addMatchedIngredient(
  list: MatchedIngredient[],
  name: string,
  type: "allergen" | "keyword" | "preference",
  profileId: string
) {
  const existing = list.find(
    (m) => m.name.toLowerCase() === name.toLowerCase() && m.type === type
  );
  if (existing) {
    if (!existing.profileIds.includes(profileId)) {
      existing.profileIds.push(profileId);
    }
  } else {
    list.push({ name, type, profileIds: [profileId] });
  }
}
