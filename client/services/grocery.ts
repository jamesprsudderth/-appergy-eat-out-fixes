/*
 * Grocery Service
 *
 * Handles product search and lookup via Open Food Facts API.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:5000";

export interface GroceryProduct {
  id: string;
  name: string;
  brand: string;
  upc: string;
  imageUrl: string;
  ingredients: string[];
  allergens: string[];
  nutritionFacts?: Record<string, number>;
  prices: { store: string; price: number; url?: string }[];
}

export interface SafetyCheck {
  safe: boolean;
  warnings: string[];
  conflicts: string[];
}

class GroceryService {
  async searchProducts(query: string): Promise<GroceryProduct[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/grocery/search?q=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log("Grocery search API failed, using direct OFF:", error);
    }

    // Fallback: direct Open Food Facts call
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&fields=code,product_name,brands,ingredients_text,allergens_tags,image_url&page_size=20`,
      );
      const data = await response.json();

      return (data.products || []).map((p: any) => ({
        id: p.code,
        name: p.product_name || "Unknown Product",
        brand: p.brands || "Unknown",
        upc: p.code,
        imageUrl: p.image_url || "",
        ingredients: p.ingredients_text
          ? p.ingredients_text
              .split(/[,;]/)
              .map((i: string) => i.trim())
              .filter(Boolean)
          : [],
        allergens: (p.allergens_tags || []).map((a: string) =>
          a.replace("en:", "").replace(/-/g, " ").trim(),
        ),
        prices: [],
      }));
    } catch (error) {
      console.error("Direct OFF search failed:", error);
      return [];
    }
  }

  async getProductByUPC(upc: string): Promise<GroceryProduct | null> {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${upc}?fields=code,product_name,brands,ingredients_text,allergens_tags,image_url,nutriments`,
      );
      const data = await response.json();

      if (data.status === 0 || !data.product) return null;

      const p = data.product;
      return {
        id: p.code,
        name: p.product_name || "Unknown Product",
        brand: p.brands || "Unknown",
        upc: p.code,
        imageUrl: p.image_url || "",
        ingredients: p.ingredients_text
          ? p.ingredients_text
              .split(/[,;]/)
              .map((i: string) => i.trim())
              .filter(Boolean)
          : [],
        allergens: (p.allergens_tags || []).map((a: string) =>
          a.replace("en:", "").replace(/-/g, " ").trim(),
        ),
        nutritionFacts: p.nutriments,
        prices: [],
      };
    } catch (error) {
      console.error("Product lookup error:", error);
      return null;
    }
  }

  checkProductSafety(
    product: GroceryProduct,
    allergies: string[],
    preferences: string[],
    forbiddenKeywords: string[],
  ): SafetyCheck {
    const warnings: string[] = [];
    const conflicts: string[] = [];

    // Check allergens
    for (const allergen of allergies) {
      const lower = allergen.toLowerCase();
      const found =
        product.allergens.some((a) => a.toLowerCase().includes(lower)) ||
        product.ingredients.some((i) => i.toLowerCase().includes(lower));

      if (found) {
        conflicts.push(`Contains ${allergen}`);
      }
    }

    // Check forbidden keywords
    for (const keyword of forbiddenKeywords) {
      const lower = keyword.toLowerCase();
      const found = product.ingredients.some((i) =>
        i.toLowerCase().includes(lower),
      );
      if (found) {
        conflicts.push(`Contains forbidden ingredient: ${keyword}`);
      }
    }

    return {
      safe: conflicts.length === 0,
      warnings,
      conflicts,
    };
  }
}

export const groceryService = new GroceryService();
