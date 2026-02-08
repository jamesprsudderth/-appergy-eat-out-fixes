import { describe, it, expect } from "vitest";
import {
  computeItemFingerprint,
  updateSessionAttemptCounters,
  applyUserOverrideToResult,
  shouldCreateAdminAlert,
  normalizeTokens,
  quickHeuristicScan,
  mergeAnalysis,
  type AnalysisResult,
} from "../scanHelpers";

// ---------------------------------------------------------------------------
// Spec §4 — computeItemFingerprint precedence order
// ---------------------------------------------------------------------------
describe("computeItemFingerprint", () => {
  it("returns null when both names are null/undefined", () => {
    expect(computeItemFingerprint(null, null)).toBeNull();
    expect(computeItemFingerprint(undefined, undefined)).toBeNull();
  });

  it("returns null when both names are empty strings", () => {
    expect(computeItemFingerprint("", "")).toBeNull();
    expect(computeItemFingerprint("  ", "  ")).toBeNull();
  });

  it("uses confirmedName when both are provided (precedence)", () => {
    const fp = computeItemFingerprint("Grilled Chicken", "chicken dish");
    expect(fp).toBe("fp:grilled-chicken");
  });

  it("falls back to guessedName when confirmedName is null", () => {
    const fp = computeItemFingerprint(null, "Caesar Salad");
    expect(fp).toBe("fp:caesar-salad");
  });

  it("normalizes casing and special characters", () => {
    const fp = computeItemFingerprint("Fish & Chips!", null);
    expect(fp).toBe("fp:fish-chips");
  });

  it("trims whitespace from names", () => {
    const fp = computeItemFingerprint("  Pasta  ", null);
    expect(fp).toBe("fp:pasta");
  });
});

// ---------------------------------------------------------------------------
// Spec §1 — updateSessionAttemptCounters: 3-fail MRR escalation
// ---------------------------------------------------------------------------
describe("updateSessionAttemptCounters", () => {
  it("increments attemptCount on every call", () => {
    const result = updateSessionAttemptCounters(
      { attemptCount: 0, manualReviewCount: 0, escalationShown: false },
      false,
    );
    expect(result.attemptCount).toBe(1);
  });

  it("increments manualReviewCount when isMRR is true", () => {
    const result = updateSessionAttemptCounters(
      { attemptCount: 0, manualReviewCount: 0, escalationShown: false },
      true,
    );
    expect(result.manualReviewCount).toBe(1);
  });

  // Spec: manualReviewCount resets on safe/unsafe
  it("resets manualReviewCount to 0 when isMRR is false", () => {
    const result = updateSessionAttemptCounters(
      { attemptCount: 4, manualReviewCount: 2, escalationShown: false },
      false,
    );
    expect(result.manualReviewCount).toBe(0);
  });

  // Spec: escalation triggers at exactly 3 consecutive MRR
  it("triggers escalation at exactly 3 consecutive MRR", () => {
    let session = {
      attemptCount: 0,
      manualReviewCount: 0,
      escalationShown: false,
    };

    // MRR #1
    session = updateSessionAttemptCounters(session, true);
    expect(session.shouldShowEscalation).toBe(false);
    expect(session.manualReviewCount).toBe(1);

    // MRR #2
    session = updateSessionAttemptCounters(session, true);
    expect(session.shouldShowEscalation).toBe(false);
    expect(session.manualReviewCount).toBe(2);

    // MRR #3 — triggers escalation
    session = updateSessionAttemptCounters(session, true);
    expect(session.shouldShowEscalation).toBe(true);
    expect(session.manualReviewCount).toBe(3);
    expect(session.escalationShown).toBe(true);
  });

  // Spec: escalation only appears once per streak
  it("does not re-trigger escalation after it has been shown", () => {
    const session = {
      attemptCount: 3,
      manualReviewCount: 3,
      escalationShown: true,
    };

    // MRR #4 — should NOT re-trigger
    const result = updateSessionAttemptCounters(session, true);
    expect(result.shouldShowEscalation).toBe(false);
    expect(result.escalationShown).toBe(true);
    expect(result.manualReviewCount).toBe(4);
  });

  it("resets escalation tracking when a safe/unsafe result breaks the streak", () => {
    const session = {
      attemptCount: 3,
      manualReviewCount: 3,
      escalationShown: true,
    };

    // Safe result breaks streak
    const result = updateSessionAttemptCounters(session, false);
    expect(result.manualReviewCount).toBe(0);
    // escalationShown remains true (it was already shown)
    expect(result.escalationShown).toBe(true);
  });

  it("handles undefined session fields gracefully", () => {
    const result = updateSessionAttemptCounters({}, true);
    expect(result.attemptCount).toBe(1);
    expect(result.manualReviewCount).toBe(1);
    expect(result.escalationShown).toBe(false);
    expect(result.shouldShowEscalation).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Spec §3 — applyUserOverrideToResult: remove/add behavior
// ---------------------------------------------------------------------------
describe("applyUserOverrideToResult", () => {
  const baseResult: AnalysisResult = {
    menuItems: [{ rawText: "Peanut Butter Sandwich" }],
    allergensDetected: [
      { allergenId: "peanuts", severity: 0.9, matches: ["peanut"] },
    ],
    dietaryFlags: [],
    confidence: 0.85,
  };

  it("applies override allergens to result", () => {
    const override: Partial<AnalysisResult> = {
      allergensDetected: [
        { allergenId: "tree_nuts", severity: 0.8, matches: ["almonds"] },
      ],
    };

    const result = applyUserOverrideToResult(baseResult, override);
    expect(result.allergensDetected).toEqual(override.allergensDetected);
    expect(result.dietaryFlags).toContain("user_corrected");
  });

  it("marks result as user_corrected when allergens are overridden", () => {
    const override: Partial<AnalysisResult> = {
      allergensDetected: [
        { allergenId: "dairy", severity: 0.7, matches: ["milk"] },
      ],
    };

    const result = applyUserOverrideToResult(baseResult, override);
    expect(result.dietaryFlags).toContain("user_corrected");
  });

  it("does not add user_corrected flag when no allergen override", () => {
    const override: Partial<AnalysisResult> = {
      dietaryFlags: ["vegan"],
    };

    const result = applyUserOverrideToResult(baseResult, override);
    expect(result.dietaryFlags).toContain("vegan");
    expect(result.dietaryFlags).not.toContain("user_corrected");
  });

  it("does not duplicate user_corrected flag on repeated overrides", () => {
    const override: Partial<AnalysisResult> = {
      allergensDetected: [
        { allergenId: "soy", severity: 0.6, matches: ["soy"] },
      ],
    };

    const first = applyUserOverrideToResult(baseResult, override);
    const second = applyUserOverrideToResult(first, override);
    const correctedCount = second.dietaryFlags.filter(
      (f) => f === "user_corrected",
    ).length;
    expect(correctedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Spec §4 (Locked) — shouldCreateAdminAlert: allergen-only rule
// ---------------------------------------------------------------------------
describe("shouldCreateAdminAlert", () => {
  it("returns true when allergens are detected", () => {
    const result: AnalysisResult = {
      menuItems: [],
      allergensDetected: [
        { allergenId: "peanuts", severity: 0.9, matches: ["peanut"] },
      ],
      dietaryFlags: [],
      confidence: 0.85,
    };
    expect(shouldCreateAdminAlert(result)).toBe(true);
  });

  // Spec: never alert for preferences-only
  it("returns false when no allergens detected (preferences only)", () => {
    const result: AnalysisResult = {
      menuItems: [],
      allergensDetected: [],
      dietaryFlags: ["vegan", "gluten-free"],
      confidence: 0.85,
    };
    expect(shouldCreateAdminAlert(result)).toBe(false);
  });

  it("returns false for empty result", () => {
    const result: AnalysisResult = {
      menuItems: [],
      allergensDetected: [],
      dietaryFlags: [],
      confidence: 0,
    };
    expect(shouldCreateAdminAlert(result)).toBe(false);
  });

  it("returns true even with low confidence if allergens present", () => {
    const result: AnalysisResult = {
      menuItems: [],
      allergensDetected: [
        { allergenId: "shellfish", severity: 0.3, matches: ["shrimp"] },
      ],
      dietaryFlags: [],
      confidence: 0.2,
    };
    expect(shouldCreateAdminAlert(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Supporting functions
// ---------------------------------------------------------------------------
describe("normalizeTokens", () => {
  it("lowercases and strips non-alphanumeric characters", () => {
    expect(normalizeTokens(["Hello!", "WORLD"])).toEqual(["hello", "world"]);
  });

  it("filters out empty tokens", () => {
    expect(normalizeTokens(["", "  ", "valid"])).toEqual(["valid"]);
  });
});

describe("quickHeuristicScan", () => {
  it("detects known allergens via substring match", () => {
    const result = quickHeuristicScan("Contains peanut butter", ["peanut"]);
    expect(result.allergensDetected.length).toBe(1);
    expect(result.allergensDetected[0].allergenId).toBe("peanut");
  });

  it("returns empty allergens when none match", () => {
    const result = quickHeuristicScan("Plain rice", ["peanut", "dairy"]);
    expect(result.allergensDetected.length).toBe(0);
  });

  it("returns higher confidence when allergens detected", () => {
    const withAllergen = quickHeuristicScan("milk chocolate", ["milk"]);
    const without = quickHeuristicScan("dark chocolate", ["milk"]);
    expect(withAllergen.confidence).toBeGreaterThan(without.confidence);
  });
});

describe("mergeAnalysis", () => {
  it("prefers server data over local", () => {
    const local: Partial<AnalysisResult> = {
      menuItems: [{ rawText: "local item" }],
      confidence: 0.5,
    };
    const server: Partial<AnalysisResult> = {
      menuItems: [{ rawText: "server item" }],
      confidence: 0.9,
    };
    const merged = mergeAnalysis(local, server);
    expect(merged.menuItems[0].rawText).toBe("server item");
    expect(merged.confidence).toBe(0.9);
  });

  it("falls back to local when server fields are missing", () => {
    const local: Partial<AnalysisResult> = {
      menuItems: [{ rawText: "local item" }],
      allergensDetected: [
        { allergenId: "soy", severity: 0.5, matches: ["soy"] },
      ],
    };
    const merged = mergeAnalysis(local, {});
    expect(merged.menuItems[0].rawText).toBe("local item");
    expect(merged.allergensDetected[0].allergenId).toBe("soy");
  });
});
