/*
 * Dish Suggestions Service
 *
 * Provides safe dish suggestions based on user allergies and dietary preferences.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:5000";

export async function getSafeDishSuggestions(
  restaurantName: string,
  allergies: string[],
  preferences: string[]
): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dish-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantName,
        allergies: allergies.join(", "),
        preferences: preferences.join(", "),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.suggestions || [];
    }
  } catch (error) {
    console.log("Dish suggestions API failed, using defaults:", error);
  }

  // Fallback: generate locally
  return getLocalSuggestions(allergies, preferences);
}

function getLocalSuggestions(
  allergies: string[],
  preferences: string[]
): string[] {
  const allergiesStr = allergies.join(" ").toLowerCase();
  const preferencesStr = preferences.join(" ").toLowerCase();
  const isVegetarian = preferencesStr.includes("vegetarian");
  const isVegan = preferencesStr.includes("vegan");
  const hasGluten = allergiesStr.includes("gluten") || allergiesStr.includes("wheat");
  const hasDairy = allergiesStr.includes("dairy") || allergiesStr.includes("milk");

  if (isVegan) {
    return [
      "Roasted vegetable Buddha bowl with tahini dressing",
      "Mushroom and spinach risotto (dairy-free) with plant-based cream",
      "Thai vegetable curry with coconut rice",
      "Grilled portobello mushroom steak with herb sauce",
      "Mediterranean falafel plate with hummus and warm pita",
    ];
  }

  if (isVegetarian) {
    const suggestions = [
      "Caprese salad with fresh mozzarella and basil",
      "Vegetable lasagna with ricotta and seasonal vegetables",
      "Spinach and ricotta ravioli with sage butter",
      "Eggplant parmesan with marinara",
      "Greek salad with feta and Kalamata olives",
    ];
    if (hasDairy) {
      return suggestions.map((s) =>
        s.replace(/mozzarella|ricotta|feta|cheese/gi, "dairy-free alternative")
      );
    }
    return suggestions;
  }

  if (hasGluten) {
    return [
      "Grilled ribeye steak with potato puree (gluten-free)",
      "Pan-seared salmon with lemon butter and steamed vegetables",
      "Herb-roasted chicken with roasted root vegetables",
      "Shrimp scampi with rice (no pasta)",
      "Lamb chops with mint sauce and grilled asparagus",
    ];
  }

  return [
    "Grilled salmon with roasted vegetables",
    "Mediterranean quinoa bowl with herb dressing",
    "Herb-crusted chicken breast with steamed broccoli",
    "Shrimp stir-fry with jasmine rice",
    "Fresh garden salad with grilled tofu and balsamic vinaigrette",
  ];
}
