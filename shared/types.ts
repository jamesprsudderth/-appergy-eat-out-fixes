/**
 * Shared types for Appergy analysis pipeline.
 * Used by both client (React Native) and server (Express).
 * NO platform-specific imports allowed in this file.
 */

export type SafetyStatus = "safe" | "unsafe" | "caution";

export interface ProfileInfo {
  id: string;
  name: string;
  allergies: string[];
  preferences: string[];
  forbiddenKeywords?: string[];
}

export interface ProfileResult {
  profileId: string;
  name: string;
  safe: boolean;
  status: SafetyStatus;
  reasons: string[];
  matchedAllergens: string[];
  matchedKeywords: string[];
  matchedPreferences: string[];
}

export interface MatchedIngredient {
  name: string;
  type: "allergen" | "keyword" | "preference";
  profileIds: string[];
}

export interface AnalysisResult {
  ingredients: string[];
  results: ProfileResult[];
  matchedIngredients: MatchedIngredient[];
  rawExtractedText?: string;
  warnings?: string[];
  _isMock?: boolean;
}
