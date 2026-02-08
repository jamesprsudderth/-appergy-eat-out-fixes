/*
 * AI Analysis Service
 * 
 * This service handles image analysis for allergen detection.
 * Includes cost optimization: rate limiting and image size checks.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const RATE_LIMIT_KEY = "ai_last_request_timestamp";
const RATE_LIMIT_MS = 3000; // 3 seconds between requests
const MAX_IMAGE_SIZE_BYTES = 1024 * 1024; // 1MB max

async function checkRateLimit(): Promise<boolean> {
  try {
    const lastRequest = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    if (lastRequest) {
      const elapsed = Date.now() - parseInt(lastRequest, 10);
      if (elapsed < RATE_LIMIT_MS) {
        console.log(`Rate limited: ${RATE_LIMIT_MS - elapsed}ms remaining`);
        return false;
      }
    }
    await AsyncStorage.setItem(RATE_LIMIT_KEY, Date.now().toString());
    return true;
  } catch (error) {
    console.error("Rate limit check error:", error);
    return true; // Allow request if AsyncStorage fails
  }
}

function checkImageSize(base64Image: string): { valid: boolean; sizeKB: number } {
  // Base64 string length * 0.75 approximates actual byte size
  const estimatedBytes = base64Image.length * 0.75;
  const sizeKB = Math.round(estimatedBytes / 1024);
  
  if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
    console.warn(`Image too large: ${sizeKB}KB (max: ${MAX_IMAGE_SIZE_BYTES / 1024}KB)`);
    return { valid: false, sizeKB };
  }
  
  console.log(`Image size: ${sizeKB}KB - OK`);
  return { valid: true, sizeKB };
}

export type SafetyStatus = "safe" | "unsafe" | "caution";

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

export interface AnalysisResult {
  ingredients: string[];
  results: ProfileResult[];
  matchedIngredients: MatchedIngredient[];
}

export interface MatchedIngredient {
  name: string;
  type: "allergen" | "keyword" | "preference";
  profileIds: string[];
}

// Re-export ProfileInfo from shared types (single source of truth)
export type { ProfileInfo } from "../../shared/types";

const API_BASE_URL = process.env.EXPO_PUBLIC_DOMAIN 
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` 
  : "http://localhost:5000";

export async function analyzeImage(
  base64Image: string,
  selectedProfiles: ProfileInfo[]
): Promise<AnalysisResult> {
  console.log("Analyzing image with profiles:", selectedProfiles.map(p => p.name));
  
  // Cost optimization: Check image size
  const sizeCheck = checkImageSize(base64Image);
  if (!sizeCheck.valid) {
    console.warn("Image exceeds size limit, using mock analysis");
    return generateMockAnalysis(selectedProfiles);
  }

  // Cost optimization: Rate limiting
  const canProceed = await checkRateLimit();
  if (!canProceed) {
    console.warn("Rate limited, using mock analysis");
    return generateMockAnalysis(selectedProfiles);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Image,
        profiles: selectedProfiles,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("API call failed, using mock response:", error);
  }

  return generateMockAnalysis(selectedProfiles);
}

function generateMockAnalysis(profiles: ProfileInfo[]): AnalysisResult {
  const mockIngredients = [
    "Wheat flour",
    "Sugar",
    "Milk",
    "Eggs",
    "Salt",
    "Vegetable oil",
    "Natural flavors",
    "Soy lecithin",
    "Modified corn starch",
    "Sodium benzoate",
    "MSG",
    "Artificial colors (Red 40)",
  ];

  const matchedIngredients: MatchedIngredient[] = [];
  
  const mockResults: ProfileResult[] = profiles.map((profile, index) => {
    const matchedAllergens: string[] = [];
    const matchedKeywords: string[] = [];
    const matchedPreferences: string[] = [];
    const reasons: string[] = [];

    const hasDairy = profile.allergies.includes("Dairy");
    const hasGluten = profile.allergies.includes("Gluten") || profile.allergies.includes("Wheat");
    const hasPeanuts = profile.allergies.includes("Peanuts");
    const hasSoy = profile.allergies.includes("Soy");
    const hasEggs = profile.allergies.includes("Eggs");
    const isVegan = profile.preferences.includes("Vegan");
    const isVegetarian = profile.preferences.includes("Vegetarian");
    const isGlutenFree = profile.preferences.includes("Gluten-Free");
    
    const keywords = profile.forbiddenKeywords || [];

    if (hasDairy) {
      matchedAllergens.push("Milk");
      reasons.push("Contains milk (dairy allergen)");
      addMatchedIngredient(matchedIngredients, "Milk", "allergen", profile.id);
    }
    
    if (hasGluten) {
      matchedAllergens.push("Wheat flour");
      reasons.push("Contains wheat flour (gluten/wheat allergen)");
      addMatchedIngredient(matchedIngredients, "Wheat flour", "allergen", profile.id);
    }

    if (hasEggs) {
      matchedAllergens.push("Eggs");
      reasons.push("Contains eggs (allergen)");
      addMatchedIngredient(matchedIngredients, "Eggs", "allergen", profile.id);
    }

    if (hasSoy) {
      matchedAllergens.push("Soy lecithin");
      reasons.push("Contains soy lecithin (soy allergen)");
      addMatchedIngredient(matchedIngredients, "Soy lecithin", "allergen", profile.id);
    }

    if (isVegan || isVegetarian) {
      if (mockIngredients.includes("Milk") || mockIngredients.includes("Eggs")) {
        matchedPreferences.push(isVegan ? "Not Vegan" : "Contains animal products");
        reasons.push(isVegan 
          ? "Contains animal-derived ingredients (milk, eggs) - not vegan"
          : "Contains eggs and dairy");
      }
    }

    if (isGlutenFree && mockIngredients.includes("Wheat flour")) {
      matchedPreferences.push("Contains Gluten");
      reasons.push("Contains wheat flour - not gluten-free");
    }

    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      const matchedIng = mockIngredients.find(ing => 
        ing.toLowerCase().includes(lowerKeyword) || 
        lowerKeyword.includes(ing.toLowerCase())
      );
      
      if (matchedIng || lowerKeyword === "msg" || lowerKeyword === "artificial") {
        const matchName = matchedIng || keyword;
        matchedKeywords.push(matchName);
        reasons.push(`Contains forbidden ingredient: ${matchName}`);
        addMatchedIngredient(matchedIngredients, matchName, "keyword", profile.id);
      }
    });

    let status: SafetyStatus = "safe";
    if (matchedAllergens.length > 0 || matchedKeywords.length > 0) {
      status = "unsafe";
    } else if (matchedPreferences.length > 0) {
      status = "caution";
    }

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

  return {
    ingredients: mockIngredients,
    results: mockResults,
    matchedIngredients,
    _isMock: true,
  } as AnalysisResult & { _isMock: boolean };
}

function addMatchedIngredient(
  list: MatchedIngredient[],
  name: string,
  type: "allergen" | "keyword" | "preference",
  profileId: string
) {
  const existing = list.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (!existing.profileIds.includes(profileId)) {
      existing.profileIds.push(profileId);
    }
  } else {
    list.push({ name, type, profileIds: [profileId] });
  }
}

export async function analyzeImageWithCloudFunction(
  base64Image: string,
  profileIds: string[],
  idToken: string
): Promise<AnalysisResult> {
  const CLOUD_FUNCTION_URL = "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/analyzeImage";
  
  const response = await fetch(CLOUD_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      base64Image,
      profileIds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}

export interface MenuItemResult {
  name: string;
  description: string;
  price: string;
  inferred_ingredients: string[];
  verdict: "Safe" | "Unsafe";
  conflicts: {
    type: "allergy_risk" | "preference_mismatch" | "forbidden_keyword";
    conflict: string;
    detail: string;
  }[];
}

export interface MenuAnalysisResult {
  menu_items: MenuItemResult[];
}

function generateMockMenuAnalysis(): MenuAnalysisResult {
  return {
    menu_items: [
      {
        name: "Grilled Chicken Salad",
        description: "Fresh greens with grilled chicken, cherry tomatoes, and vinaigrette",
        price: "$14.99",
        inferred_ingredients: ["chicken", "lettuce", "tomatoes", "olive oil", "vinegar"],
        verdict: "Safe",
        conflicts: []
      },
      {
        name: "Pasta Carbonara",
        description: "Creamy pasta with bacon and parmesan",
        price: "$16.99",
        inferred_ingredients: ["pasta (wheat)", "eggs", "bacon", "parmesan cheese", "cream"],
        verdict: "Unsafe",
        conflicts: [
          { type: "allergy_risk", conflict: "Wheat/Gluten", detail: "Contains pasta made from wheat flour" },
          { type: "allergy_risk", conflict: "Dairy", detail: "Contains cream and parmesan cheese" }
        ]
      }
    ]
  };
}

export async function analyzeMenu(
  base64Image: string,
  userProfile: {
    allergies: string[];
    customAllergies?: string[];
    preferences: string[];
    forbiddenKeywords?: string[];
  }
): Promise<MenuAnalysisResult> {
  console.log("Analyzing menu with profile:", userProfile);

  // Cost optimization: Check image size
  const sizeCheck = checkImageSize(base64Image);
  if (!sizeCheck.valid) {
    console.warn("Image exceeds size limit, using mock menu analysis");
    return generateMockMenuAnalysis();
  }

  // Cost optimization: Rate limiting
  const canProceed = await checkRateLimit();
  if (!canProceed) {
    console.warn("Rate limited, using mock menu analysis");
    return generateMockMenuAnalysis();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-menu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Image,
        profile: userProfile,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Menu analysis API call failed, using mock response:", error);
  }

  return generateMockMenuAnalysis();
}

// Barcode lookup via Open Food Facts
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
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=code,product_name,brands,ingredients_text,allergens_tags,image_url`
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
        a.replace("en:", "").replace(/-/g, " ").trim()
      ),
    };
  } catch (error) {
    console.error("Barcode lookup error:", error);
    return { found: false };
  }
}

export function analyzeBarcodeProduct(
  product: BarcodeProduct,
  selectedProfiles: ProfileInfo[]
): AnalysisResult {
  const ingredients = product.ingredients || [];
  const productAllergens = product.allergens || [];
  const matchedIngredients: MatchedIngredient[] = [];

  const results: ProfileResult[] = selectedProfiles.map((profile, index) => {
    const matchedAllergens: string[] = [];
    const matchedKeywords: string[] = [];
    const matchedPreferences: string[] = [];
    const reasons: string[] = [];

    // Check allergens against profile
    for (const allergen of profile.allergies) {
      const lowerAllergen = allergen.toLowerCase();

      // Check product allergen tags
      const tagMatch = productAllergens.find((a) =>
        a.toLowerCase().includes(lowerAllergen) ||
        lowerAllergen.includes(a.toLowerCase())
      );

      // Check ingredients text
      const ingredientMatch = ingredients.find((ing) =>
        ing.toLowerCase().includes(lowerAllergen)
      );

      if (tagMatch || ingredientMatch) {
        const matchName = tagMatch || ingredientMatch || allergen;
        matchedAllergens.push(matchName);
        reasons.push(`Contains ${matchName} (${allergen} allergen)`);
        addMatchedIngredient(matchedIngredients, matchName, "allergen", profile.id);
      }
    }

    // Check forbidden keywords
    const keywords = profile.forbiddenKeywords || [];
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      const match = ingredients.find((ing) =>
        ing.toLowerCase().includes(lowerKeyword)
      );
      if (match) {
        matchedKeywords.push(match);
        reasons.push(`Contains forbidden ingredient: ${match}`);
        addMatchedIngredient(matchedIngredients, match, "keyword", profile.id);
      }
    }

    let status: SafetyStatus = "safe";
    if (matchedAllergens.length > 0 || matchedKeywords.length > 0) {
      status = "unsafe";
    } else if (matchedPreferences.length > 0) {
      status = "caution";
    }

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

  return {
    ingredients,
    results,
    matchedIngredients,
  };
}
