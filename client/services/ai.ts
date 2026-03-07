/*
 * AI Analysis Service
 *
 * Client-side wrapper for the server's analysis API.
 * All AI logic runs on the server — this file handles the HTTP call,
 * image size validation, and type definitions consumed by screens.
 */

import type { ProfileInfo, AnalysisResult, ProfileResult, MatchedIngredient } from "../../shared/types";
import { authFetch } from "./apiClient";

// Re-export shared types so existing screens don't need to change imports
export type { ProfileInfo, AnalysisResult, ProfileResult, MatchedIngredient };
export type SafetyStatus = "safe" | "unsafe" | "caution";

const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500 KB (VISION.md §10.1)

function checkImageSize(base64Image: string): { valid: boolean; sizeKB: number } {
  const estimatedBytes = base64Image.length * 0.75;
  const sizeKB = Math.round(estimatedBytes / 1024);
  return { valid: estimatedBytes <= MAX_IMAGE_SIZE_BYTES, sizeKB };
}

export async function analyzeImage(
  base64Image: string,
  selectedProfiles: ProfileInfo[],
  productName?: string,
): Promise<AnalysisResult> {
  const sizeCheck = checkImageSize(base64Image);
  if (!sizeCheck.valid) {
    throw new Error(
      `Image is too large (${sizeCheck.sizeKB} KB). Please take a closer photo to reduce file size.`,
    );
  }

  const response = await authFetch("/api/analyze-image", {
    method: "POST",
    body: JSON.stringify({
      base64Image,
      profiles: selectedProfiles,
      productName: productName ?? null,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `Analysis failed (${response.status})`);
  }

  return response.json();
}

// ─── Menu Analysis ────────────────────────────────────────────────────────────

export interface MenuIngredient {
  name: string;
  source: "explicit" | "inferred";
}

export interface MenuConflict {
  type: "allergy_risk" | "preference_mismatch" | "forbidden_keyword";
  ingredient: string;
  source: "explicit" | "inferred";
  detail: string;
}

export interface MenuItemResult {
  name: string;
  description: string;
  price: string | null;
  ingredients: MenuIngredient[];
  verdict: "Safe" | "Caution" | "Unsafe";
  confidence: "high" | "medium" | "low";
  conflicts: MenuConflict[];
}

export interface MenuAnalysisResult {
  menu_items: MenuItemResult[];
}

export async function analyzeMenu(
  base64Image: string,
  userProfile: {
    allergies: string[];
    customAllergies?: string[];
    preferences: string[];
    forbiddenKeywords?: string[];
  },
): Promise<MenuAnalysisResult> {
  const sizeCheck = checkImageSize(base64Image);
  if (!sizeCheck.valid) {
    throw new Error(
      `Image is too large (${sizeCheck.sizeKB} KB). Please take a closer photo to reduce file size.`,
    );
  }

  const response = await authFetch("/api/analyze-menu", {
    method: "POST",
    body: JSON.stringify({ base64Image, profile: userProfile }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `Menu analysis failed (${response.status})`);
  }

  return response.json();
}

// ─── Barcode Lookup (Open Food Facts) ────────────────────────────────────────

export interface BarcodeProduct {
  found: boolean;
  name?: string;
  brand?: string;
  ingredients?: string[];
  allergens?: string[];
  imageUrl?: string;
  upc?: string;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=code,product_name,brands,ingredients_text,allergens_tags,image_url`,
    );
    const data = await response.json();

    if (data.status === 0 || !data.product) {
      return { found: false };
    }

    const p = data.product;
    return {
      found: true,
      name: p.product_name || "Unknown Product",
      brand: p.brands || "Unknown",
      upc: p.code,
      imageUrl: p.image_url || "",
      ingredients: p.ingredients_text
        ? p.ingredients_text.split(/[,;]/).map((i: string) => i.trim()).filter(Boolean)
        : [],
      allergens: (p.allergens_tags || []).map((a: string) =>
        a.replace("en:", "").replace(/-/g, " ").trim(),
      ),
    };
  } catch (error) {
    console.error("Barcode lookup error:", error);
    return { found: false };
  }
}

export function analyzeBarcodeProduct(
  product: BarcodeProduct,
  selectedProfiles: ProfileInfo[],
): AnalysisResult {
  const ingredients = product.ingredients || [];
  const productAllergens = product.allergens || [];
  const matchedIngredients: MatchedIngredient[] = [];

  const results: ProfileResult[] = selectedProfiles.map((profile, index) => {
    const matchedAllergens: string[] = [];
    const matchedKeywords: string[] = [];
    const matchedPreferences: string[] = [];
    const reasons: string[] = [];

    for (const allergen of profile.allergies) {
      const lower = allergen.toLowerCase();
      const tagMatch = productAllergens.find((a) =>
        a.toLowerCase().includes(lower) || lower.includes(a.toLowerCase()),
      );
      const ingredientMatch = ingredients.find((ing) => ing.toLowerCase().includes(lower));

      if (tagMatch || ingredientMatch) {
        const matchName = tagMatch || ingredientMatch || allergen;
        matchedAllergens.push(matchName);
        reasons.push(`Contains ${matchName} (${allergen} allergen)`);
        addToMatched(matchedIngredients, matchName, "allergen", profile.id);
      }
    }

    for (const keyword of profile.forbiddenKeywords || []) {
      const match = ingredients.find((ing) =>
        ing.toLowerCase().includes(keyword.toLowerCase()),
      );
      if (match) {
        matchedKeywords.push(match);
        reasons.push(`Contains forbidden ingredient: ${match}`);
        addToMatched(matchedIngredients, match, "keyword", profile.id);
      }
    }

    const status: SafetyStatus =
      matchedAllergens.length > 0 || matchedKeywords.length > 0
        ? "unsafe"
        : matchedPreferences.length > 0
          ? "caution"
          : "safe";

    return {
      profileId: profile.id,
      name: profile.name || `Profile ${index + 1}`,
      safe: status === "safe",
      status,
      reasons,
      matchedAllergens,
      matchedKeywords,
      matchedPreferences,
    };
  });

  return { ingredients, results, matchedIngredients };
}

function addToMatched(
  list: MatchedIngredient[],
  name: string,
  type: "allergen" | "keyword" | "preference",
  profileId: string,
) {
  const existing = list.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (!existing.profileIds.includes(profileId)) existing.profileIds.push(profileId);
  } else {
    list.push({ name, type, profileIds: [profileId] });
  }
}
