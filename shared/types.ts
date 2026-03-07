/**
 * Shared types for Appergy analysis pipeline.
 * Used by both client (React Native) and server (Express).
 * NO platform-specific imports allowed in this file.
 */

export type SafetyStatus = "safe" | "unsafe" | "caution";

export type UserRole = "admin" | "member";

export interface ProfileInfo {
  id: string;
  name: string;
  allergies: string[];
  customAllergies?: string[];
  preferences: string[];
  customPreferences?: string[];
  forbiddenKeywords?: string[];
  /** Whether "May contain" cross-contamination warnings are treated as UNSAFE (default: CAUTION) */
  treatMayContainAsUnsafe?: boolean;
  /** Severity levels per allergen: "mild" | "moderate" | "severe" | "life-threatening" */
  allergySeverity?: Record<string, AllergySeverity>;
  /** Emergency contact info for this profile */
  emergencyContact?: EmergencyContact;
}

export type AllergySeverity = "mild" | "moderate" | "severe" | "life-threatening";

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
  instructions?: string;
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
  ocrConfidence?: "high" | "medium" | "low";
  /**
   * Numeric confidence in the extraction pipeline (0.0 – 1.0).
   * Derived from OCR confidence: high→0.97, medium→0.82, low→0.65.
   */
  confidenceScore?: number;
  /** Bucketed label for UI display. */
  confidenceLevel?: "high" | "medium" | "low";
  /**
   * When true the pipeline confidence was too low to trust the verdict.
   * The client must NOT show a safe/unsafe verdict — prompt manual review instead.
   */
  reviewRequired?: boolean;
  warnings?: string[];
  /** Scan history document ID written by the server after analysis. */
  scanId?: string;
  _isMock?: boolean;
}

/** Profile export (PDF/QR) metadata */
export interface ProfileExport {
  profileId: string;
  profileName: string;
  allergies: { name: string; severity: AllergySeverity }[];
  preferences: string[];
  forbiddenKeywords: string[];
  emergencyContact?: EmergencyContact;
  exportedAt: string;
  expiresAt: string;
  exportedBy: string;
}

