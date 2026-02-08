/*
 * Policy Engine
 *
 * Deterministic rule-based safety checker.
 * Takes parsed ingredients + user profile → produces structured findings
 * with exact evidence spans for UI highlighting.
 *
 * Three categories checked:
 *   1. Allergens (via synonym map) → UNSAFE
 *   2. Dietary Preferences (via dietary rules) → UNSAFE or CAUTION
 *   3. Forbidden Keywords (user's custom list) → UNSAFE
 *
 * Principle: Prefer false positive (CAUTION) over false negative (SAFE).
 */

import {
  ALLERGEN_SYNONYM_MAP,
  CanonicalAllergen,
} from "./allergenDatabase";
import { DIETARY_RULES, DietaryRule } from "./dietaryDatabase";
import {
  ParsedLabel,
  findEvidenceSpans,
} from "./ingredientNormalizer";

// ─── Types ───

export type FindingKind = "ALLERGEN" | "DIETARY" | "FORBIDDEN_KEYWORD";
export type FindingSeverity = "UNSAFE" | "CAUTION";

export interface Finding {
  /** Which category triggered this */
  kind: FindingKind;
  /** UNSAFE or CAUTION */
  severity: FindingSeverity;
  /** The exact text that matched in the ingredient list */
  matchedText: string;
  /** The canonical term it maps to (e.g., "Milk", "Vegan") */
  canonicalTerm: string;
  /** Human-readable explanation */
  reason: string;
  /** Character spans in the raw text for UI highlighting */
  evidenceSpans: { start: number; end: number }[];
  /** Source: which section of the label ("ingredients" | "contains" | "may_contain") */
  source: "ingredients" | "contains" | "may_contain";
  /** Confidence: 1.0 for exact match, 0.8 for synonym, 0.5 for fuzzy */
  confidence: number;
}

export interface PolicyResult {
  /** Overall safety status */
  status: "SAFE" | "CAUTION" | "UNSAFE";
  /** All findings that triggered warnings */
  findings: Finding[];
  /** Overall confidence (lowest finding confidence) */
  confidence: number;
  /** Per-profile ID this result applies to */
  profileId: string;
  /** Profile display name */
  profileName: string;
  /** Summary counts */
  allergenCount: number;
  dietaryCount: number;
  keywordCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  /** Canonical allergen names: "Milk", "Eggs", "Peanuts", etc. */
  allergies: string[];
  /** Custom allergens added by user (not in standard list) */
  customAllergies?: string[];
  /** Dietary preference keys: "Vegan", "Keto / Low-carb", etc. */
  preferences: string[];
  /** Custom preferences added by user */
  customPreferences?: string[];
  /** User's forbidden keyword list */
  forbiddenKeywords: string[];
  /** Whether "may contain" should be treated as unsafe */
  treatMayContainAsUnsafe?: boolean;
}

// ─── Main Engine ───

/**
 * Run the full policy check for one profile against a parsed label.
 */
export function evaluateLabel(
  parsedLabel: ParsedLabel,
  profile: UserProfile
): PolicyResult {
  const findings: Finding[] = [];
  const rawText = parsedLabel.normalizedText;

  // 1. Check allergens
  const allergenFindings = checkAllergens(parsedLabel, profile, rawText);
  findings.push(...allergenFindings);

  // 2. Check dietary preferences
  const dietaryFindings = checkDietaryPreferences(parsedLabel, profile, rawText);
  findings.push(...dietaryFindings);

  // 3. Check forbidden keywords
  const keywordFindings = checkForbiddenKeywords(parsedLabel, profile, rawText);
  findings.push(...keywordFindings);

  // Determine overall status
  const hasUnsafe = findings.some((f) => f.severity === "UNSAFE");
  const hasCaution = findings.some((f) => f.severity === "CAUTION");

  let status: "SAFE" | "CAUTION" | "UNSAFE" = "SAFE";
  if (hasUnsafe) status = "UNSAFE";
  else if (hasCaution) status = "CAUTION";

  // Confidence is the minimum across all findings (or 1.0 if no findings)
  const confidence =
    findings.length > 0
      ? Math.min(...findings.map((f) => f.confidence))
      : 1.0;

  return {
    status,
    findings,
    confidence,
    profileId: profile.id,
    profileName: profile.name,
    allergenCount: findings.filter((f) => f.kind === "ALLERGEN").length,
    dietaryCount: findings.filter((f) => f.kind === "DIETARY").length,
    keywordCount: findings.filter((f) => f.kind === "FORBIDDEN_KEYWORD").length,
  };
}

/**
 * Run policy check for multiple profiles against the same label.
 */
export function evaluateLabelForProfiles(
  parsedLabel: ParsedLabel,
  profiles: UserProfile[]
): PolicyResult[] {
  return profiles.map((profile) => evaluateLabel(parsedLabel, profile));
}

// ─── Allergen Checking ───

function checkAllergens(
  parsedLabel: ParsedLabel,
  profile: UserProfile,
  rawText: string
): Finding[] {
  const findings: Finding[] = [];
  const allAllergies = [
    ...profile.allergies,
    ...(profile.customAllergies || []),
  ];

  if (allAllergies.length === 0) return findings;

  // Known false positives: ingredient phrases that contain allergen synonym
  // substrings but are NOT actually that allergen.
  const FALSE_POSITIVE_EXCLUSIONS: Record<string, string[]> = {
    // "butter" is dairy, but these are NOT dairy:
    "Milk": [
      "cocoa butter", "shea butter", "mango butter", "kokum butter",
      "peanut butter", "almond butter", "cashew butter", "sunflower butter",
      "nut butter", "seed butter", "soy butter", "coconut butter",
    ],
    // "lecithin" maps to Soy, but sunflower lecithin is soy-free:
    "Soy": [
      "sunflower lecithin",
    ],
    // "livetin" is an egg protein, but "live" (as in "live cultures") is not:
    "Eggs": [
      "live and active cultures", "live cultures", "live active cultures",
    ],
  };

  /**
   * Check if an ingredient text is a known false positive for a given allergen.
   */
  function isFalsePositive(ingredientLower: string, allergen: string): boolean {
    const exclusions = FALSE_POSITIVE_EXCLUSIONS[allergen];
    if (!exclusions) return false;
    return exclusions.some((excl) => ingredientLower.includes(excl));
  }

  // Build a set of canonical allergens the user has
  const userAllergenSet = new Set(
    allAllergies.map((a) => a.toLowerCase())
  );

  // Check each ingredient against the synonym map
  for (const ingredient of parsedLabel.ingredients) {
    const lower = ingredient.toLowerCase().trim();

    // Direct synonym map lookup
    const canonical = ALLERGEN_SYNONYM_MAP[lower];
    if (
      canonical &&
      userAllergenSet.has(canonical.toLowerCase()) &&
      !isFalsePositive(lower, canonical)
    ) {
      const spans = findEvidenceSpans(rawText, ingredient);
      findings.push({
        kind: "ALLERGEN",
        severity: "UNSAFE",
        matchedText: ingredient,
        canonicalTerm: canonical,
        reason: `"${ingredient}" is a ${canonical} derivative — ${canonical} allergen`,
        evidenceSpans: spans,
        source: "ingredients",
        confidence: 1.0,
      });
      continue;
    }

    // Partial/substring match against synonym map keys
    // e.g., ingredient "whey powder blend" contains "whey powder" which maps to Milk
    // But: "salt" should NOT match "sesame salt" — only match if ingredient contains the term,
    // not the other way around (term.includes(lower)) when the term is much longer.
    for (const [term, allergen] of Object.entries(ALLERGEN_SYNONYM_MAP)) {
      if (!userAllergenSet.has(allergen.toLowerCase())) continue;

      // Ingredient must contain the synonym term (not reverse)
      // Only allow reverse match if ingredient is very close in length (±3 chars)
      const ingredientContainsTerm = lower.includes(term);
      const termContainsIngredient =
        term.includes(lower) && Math.abs(term.length - lower.length) <= 3;

      if (!ingredientContainsTerm && !termContainsIngredient) continue;

      // Check for known false positives
      if (isFalsePositive(lower, allergen)) continue;

      // Avoid duplicate findings for same allergen+ingredient
      const alreadyFound = findings.some(
        (f) =>
          f.kind === "ALLERGEN" &&
          f.canonicalTerm === allergen &&
          f.matchedText === ingredient
      );
      if (alreadyFound) continue;

      const spans = findEvidenceSpans(rawText, ingredient);
      findings.push({
        kind: "ALLERGEN",
        severity: "UNSAFE",
        matchedText: ingredient,
        canonicalTerm: allergen,
        reason: `"${ingredient}" contains "${term}" — ${allergen} allergen`,
        evidenceSpans: spans,
        source: "ingredients",
        confidence: 0.9,
      });
      break; // Only need one match per ingredient
    }

    // Direct allergen name match (for custom allergies not in synonym map)
    for (const allergen of allAllergies) {
      const lowerAllergen = allergen.toLowerCase();
      if (
        lower.includes(lowerAllergen) ||
        lowerAllergen.includes(lower)
      ) {
        const alreadyFound = findings.some(
          (f) =>
            f.kind === "ALLERGEN" &&
            f.matchedText === ingredient
        );
        if (alreadyFound) continue;

        const spans = findEvidenceSpans(rawText, ingredient);
        findings.push({
          kind: "ALLERGEN",
          severity: "UNSAFE",
          matchedText: ingredient,
          canonicalTerm: allergen,
          reason: `"${ingredient}" matches your "${allergen}" allergy`,
          evidenceSpans: spans,
          source: "ingredients",
          confidence: 0.85,
        });
      }
    }
  }

  // Check "Contains:" statements (high confidence)
  for (const statement of parsedLabel.containsStatements) {
    for (const allergen of allAllergies) {
      const lowerAllergen = allergen.toLowerCase();
      if (
        statement.includes(lowerAllergen) ||
        lowerAllergen.includes(statement)
      ) {
        const alreadyFound = findings.some(
          (f) =>
            f.kind === "ALLERGEN" &&
            f.canonicalTerm.toLowerCase() === lowerAllergen
        );
        if (alreadyFound) continue;

        const spans = findEvidenceSpans(rawText, statement);
        findings.push({
          kind: "ALLERGEN",
          severity: "UNSAFE",
          matchedText: statement,
          canonicalTerm: allergen,
          reason: `Label declares "Contains: ${statement}" — ${allergen} allergen`,
          evidenceSpans: spans,
          source: "contains",
          confidence: 1.0,
        });
      }
    }
  }

  // Check "May contain:" statements
  for (const statement of parsedLabel.mayContainStatements) {
    for (const allergen of allAllergies) {
      const lowerAllergen = allergen.toLowerCase();
      if (
        statement.includes(lowerAllergen) ||
        lowerAllergen.includes(statement)
      ) {
        const alreadyFound = findings.some(
          (f) =>
            f.kind === "ALLERGEN" &&
            f.canonicalTerm.toLowerCase() === lowerAllergen &&
            f.source === "may_contain"
        );
        if (alreadyFound) continue;

        const severity = profile.treatMayContainAsUnsafe
          ? "UNSAFE"
          : "CAUTION";
        const spans = findEvidenceSpans(rawText, statement);
        findings.push({
          kind: "ALLERGEN",
          severity,
          matchedText: statement,
          canonicalTerm: allergen,
          reason: `Label warns "May contain: ${statement}" — possible ${allergen} cross-contamination`,
          evidenceSpans: spans,
          source: "may_contain",
          confidence: 0.6,
        });
      }
    }
  }

  return deduplicateFindings(findings);
}

// ─── Dietary Preference Checking ───

function checkDietaryPreferences(
  parsedLabel: ParsedLabel,
  profile: UserProfile,
  rawText: string
): Finding[] {
  const findings: Finding[] = [];
  const allPreferences = [
    ...profile.preferences,
    ...(profile.customPreferences || []),
  ];

  if (allPreferences.length === 0) return findings;

  // Known plant-based "butter" and "milk" terms that are NOT animal-derived
  const PLANT_BASED_EXCEPTIONS = [
    "cocoa butter", "shea butter", "mango butter", "kokum butter",
    "peanut butter", "almond butter", "cashew butter", "sunflower butter",
    "nut butter", "seed butter", "coconut butter", "soy butter",
    "almond milk", "oat milk", "soy milk", "coconut milk", "rice milk",
    "cashew milk", "hemp milk",
    "coconut cream", "coconut oil",
    "sunflower lecithin",
  ];

  function isPlantBasedException(ingredientLower: string, violationTerm: string): boolean {
    // Only applies to terms like "butter", "milk", "cream", "lecithin"
    const ambiguousTerms = ["butter", "milk", "cream", "lecithin", "ice cream"];
    if (!ambiguousTerms.includes(violationTerm)) return false;
    return PLANT_BASED_EXCEPTIONS.some((exc) => ingredientLower.includes(exc));
  }

  for (const prefKey of allPreferences) {
    const rule = DIETARY_RULES[prefKey];
    if (!rule) {
      // Custom preference — treat as keyword search
      continue;
    }

    // Check violation terms → UNSAFE
    for (const ingredient of parsedLabel.ingredients) {
      const lower = ingredient.toLowerCase().trim();

      for (const violationTerm of rule.violationTerms) {
        const ingredientContainsViolation = lower.includes(violationTerm);
        const violationContainsIngredient =
          violationTerm.includes(lower) &&
          lower.length >= 3 &&
          Math.abs(violationTerm.length - lower.length) <= 4;

        if (!ingredientContainsViolation && !violationContainsIngredient) continue;

        // Skip known plant-based exceptions
        if (isPlantBasedException(lower, violationTerm)) continue;

          const alreadyFound = findings.some(
            (f) =>
              f.kind === "DIETARY" &&
              f.canonicalTerm === rule.label &&
              f.matchedText === ingredient
          );
          if (alreadyFound) continue;

          const spans = findEvidenceSpans(rawText, ingredient);
          findings.push({
            kind: "DIETARY",
            severity: "UNSAFE",
            matchedText: ingredient,
            canonicalTerm: rule.label,
            reason: `"${ingredient}" is ${rule.reasonTemplate} — violates ${rule.label} preference`,
            evidenceSpans: spans,
            source: "ingredients",
            confidence: 0.95,
          });
          break;
        }

      // Check caution terms → CAUTION
      for (const cautionTerm of rule.cautionTerms) {
        const ingContainsCaution = lower.includes(cautionTerm);
        const cautionContainsIng =
          cautionTerm.includes(lower) &&
          lower.length >= 3 &&
          Math.abs(cautionTerm.length - lower.length) <= 4;

        if (!ingContainsCaution && !cautionContainsIng) continue;

          const alreadyFound = findings.some(
            (f) =>
              f.kind === "DIETARY" &&
              f.canonicalTerm === rule.label &&
              f.matchedText === ingredient
          );
          if (alreadyFound) continue;

          const spans = findEvidenceSpans(rawText, ingredient);
          findings.push({
            kind: "DIETARY",
            severity: "CAUTION",
            matchedText: ingredient,
            canonicalTerm: rule.label,
            reason: `"${ingredient}" may be ${rule.reasonTemplate} — check if compatible with ${rule.label}`,
            evidenceSpans: spans,
            source: "ingredients",
            confidence: 0.6,
          });
          break;
      }
    }
  }

  return deduplicateFindings(findings);
}

// ─── Forbidden Keyword Checking ───

function checkForbiddenKeywords(
  parsedLabel: ParsedLabel,
  profile: UserProfile,
  rawText: string
): Finding[] {
  const findings: Finding[] = [];
  const keywords = profile.forbiddenKeywords || [];

  if (keywords.length === 0) return findings;

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (!lowerKeyword) continue;

    for (const ingredient of parsedLabel.ingredients) {
      const lower = ingredient.toLowerCase().trim();

      if (lower.includes(lowerKeyword) || lowerKeyword.includes(lower)) {
        const spans = findEvidenceSpans(rawText, ingredient);
        findings.push({
          kind: "FORBIDDEN_KEYWORD",
          severity: "UNSAFE",
          matchedText: ingredient,
          canonicalTerm: keyword,
          reason: `"${ingredient}" matches your forbidden keyword "${keyword}"`,
          evidenceSpans: spans,
          source: "ingredients",
          confidence: 1.0,
        });
        break;
      }
    }

    // Also check raw text directly (catches things the tokenizer might miss)
    if (rawText.toLowerCase().includes(lowerKeyword)) {
      const alreadyFound = findings.some(
        (f) =>
          f.kind === "FORBIDDEN_KEYWORD" &&
          f.canonicalTerm.toLowerCase() === lowerKeyword
      );
      if (!alreadyFound) {
        const spans = findEvidenceSpans(rawText, keyword);
        if (spans.length > 0) {
          findings.push({
            kind: "FORBIDDEN_KEYWORD",
            severity: "UNSAFE",
            matchedText: keyword,
            canonicalTerm: keyword,
            reason: `Found forbidden keyword "${keyword}" in label text`,
            evidenceSpans: spans,
            source: "ingredients",
            confidence: 0.9,
          });
        }
      }
    }
  }

  return deduplicateFindings(findings);
}

// ─── Helpers ───

/**
 * Remove duplicate findings (same kind + canonicalTerm + matchedText).
 */
function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.kind}|${f.canonicalTerm}|${f.matchedText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
