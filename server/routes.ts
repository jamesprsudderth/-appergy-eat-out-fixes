import type { Express } from "express";
import { createServer, type Server } from "node:http";

const OPENAI_API_KEY = const env = validateEnv();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

interface MatchedIngredient {
  name: string;
  type: "allergen" | "keyword" | "preference";
  profileIds: string[];
}

interface ProfileInfo {
  id: string;
  name: string;
  allergies: string[];
  customAllergies?: string[];
  preferences: string[];
  forbiddenKeywords?: string[];
}

function buildIngredientAnalysisPrompt(profile: ProfileInfo): string {
  const allAllergies = [...(profile.allergies || []), ...(profile.customAllergies || [])];
  
  return `You are an expert food label analyst for Appergy, a food allergy safety app.

**User Profile:**
Allergies: ${allAllergies.join(', ') || 'None'}
Preferences: ${(profile.preferences || []).join(', ') || 'None'}
Forbidden Keywords: ${(profile.forbiddenKeywords || []).join(', ') || 'None'}

**Task:** Analyze the ingredient label in the image and determine if the product is safe for this user.

**Instructions:**
1. Extract ALL ingredients listed on the label
2. Identify any allergens present, including common ones: milk, eggs, peanuts, tree nuts, fish, shellfish, wheat, soy, sesame
3. Check for "Contains:" and "May contain:" statements
4. Compare ingredients against user's allergies, preferences, and forbidden keywords
5. Provide a clear Safe/Unsafe verdict with detailed reasoning

**Output Format (JSON):**
{
  "ingredients": ["ingredient1", "ingredient2", ...],
  "detected_allergens": ["allergen1", "allergen2"],
  "verdict": "Safe" or "Unsafe",
  "conflicts": [
    {
      "type": "allergy_risk" | "preference_mismatch" | "forbidden_keyword",
      "ingredient": "The specific ingredient",
      "detail": "Why this is a problem for the user"
    }
  ],
  "warnings": ["Any 'may contain' warnings from the label"]
}

Be extremely cautious - when in doubt, mark as Unsafe. Focus on severe allergy risks first.`;
}

function buildMenuAnalysisPrompt(profile: ProfileInfo): string {
  const allAllergies = [...(profile.allergies || []), ...(profile.customAllergies || [])];
  
  return `You are an AI assistant for a food allergy app called Appergy. Your task is to analyze restaurant menu images, extract menu items, infer ingredients, and compare them against a user's dietary profile to identify potential risks.

**User Profile:**
Allergies: ${allAllergies.join(', ') || 'None'}
Preferences: ${(profile.preferences || []).join(', ') || 'None'}
Forbidden Keywords: ${(profile.forbiddenKeywords || []).join(', ') || 'None'}

**Instructions:**
1. Extract all menu items with their names, descriptions, and prices from the image
2. For each item, infer the primary ingredients typically used based on the name and description
3. Cross-reference inferred ingredients with the user's allergies, preferences, and forbidden keywords
4. Provide a verdict (Safe/Unsafe) and detailed reasoning for any conflicts
5. If uncertain about ingredients, state potential ingredients rather than definitive ones

**Output Format (JSON):**
{
  "menu_items": [
    {
      "name": "Item name",
      "description": "Item description from menu",
      "price": "Price if visible",
      "inferred_ingredients": ["ingredient1", "ingredient2"],
      "verdict": "Safe" or "Unsafe",
      "conflicts": [
        {
          "type": "allergy_risk" | "preference_mismatch" | "forbidden_keyword",
          "conflict": "The allergen/preference/keyword",
          "detail": "Explanation of the conflict"
        }
      ]
    }
  ]
}

Be thorough in identifying common allergens like milk, eggs, peanuts, tree nuts, fish, shellfish, wheat, soy, and sesame.`;
}

async function analyzeImageWithOpenAI(base64Image: string, systemPrompt: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and provide the structured JSON output as requested.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('Failed to parse AI response');
}

function generateMockIngredientAnalysis(profiles: ProfileInfo[]): any {
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

  const results = profiles.map((profile: any) => {
    const matchedAllergens: string[] = [];
    const matchedKeywords: string[] = [];
    const matchedPreferences: string[] = [];
    const reasons: string[] = [];

    const allergies = profile.allergies || [];
    const preferences = profile.preferences || [];
    const forbiddenKeywords = profile.forbiddenKeywords || [];

    if (allergies.includes("Dairy") || allergies.includes("Milk")) {
      matchedAllergens.push("Milk");
      reasons.push("Contains milk (dairy allergen)");
    }
    if (allergies.includes("Gluten") || allergies.includes("Wheat")) {
      matchedAllergens.push("Wheat flour");
      reasons.push("Contains wheat flour (gluten/wheat allergen)");
    }
    if (allergies.includes("Eggs")) {
      matchedAllergens.push("Eggs");
      reasons.push("Contains eggs (allergen)");
    }
    if (allergies.includes("Soy")) {
      matchedAllergens.push("Soy lecithin");
      reasons.push("Contains soy lecithin (soy allergen)");
    }

    if (preferences.includes("Vegan")) {
      matchedPreferences.push("Not Vegan");
      reasons.push("Contains animal-derived ingredients (milk, eggs) - not vegan");
    }
    if (preferences.includes("Gluten-Free")) {
      matchedPreferences.push("Contains Gluten");
      reasons.push("Contains wheat flour - not gluten-free");
    }

    forbiddenKeywords.forEach((keyword: string) => {
      const lowerKeyword = keyword.toLowerCase();
      const matchedIng = mockIngredients.find(ing =>
        ing.toLowerCase().includes(lowerKeyword) ||
        lowerKeyword.includes(ing.toLowerCase())
      );
      if (matchedIng) {
        matchedKeywords.push(matchedIng);
        reasons.push(`Contains forbidden ingredient: ${matchedIng}`);
      }
    });

    let status = "safe";
    if (matchedAllergens.length > 0 || matchedKeywords.length > 0) {
      status = "unsafe";
    } else if (matchedPreferences.length > 0) {
      status = "caution";
    }

    return {
      profileId: profile.id,
      name: profile.name,
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
    results,
    matchedIngredients,
  };
}

import {
  analyzeImageFull,
  analyzeExtractedText,
  extractTextFromImage,
} from "./services/analysis";

export async function registerRoutes(app: Express): Promise<Server> {

  // ─── OCR Only: Extract text from image (no analysis) ───
  app.post("/api/ocr", async (req, res) => {
    try {
      const { base64Image } = req.body;

      if (!base64Image) {
        return res.status(400).json({ error: "base64Image is required" });
      }

      if (!OPENAI_API_KEY) {
        return res.status(503).json({ error: "OCR service not configured" });
      }

      const ocr = await extractTextFromImage(base64Image, OPENAI_API_KEY);
      res.json(ocr);
    } catch (error: any) {
      console.error("Error in OCR:", error);
      res.status(500).json({ error: "Failed to extract text" });
    }
  });

  // ─── Image Analysis: OCR + Deterministic Pipeline ───
  app.post("/api/analyze-image", async (req, res) => {
    try {
      const { base64Image, profiles } = req.body;

      if (!base64Image || !profiles || !Array.isArray(profiles)) {
        return res
          .status(400)
          .json({ error: "base64Image and profiles are required" });
      }

      // Try the two-phase pipeline: OpenAI OCR → deterministic engine
      if (OPENAI_API_KEY) {
        try {
          const result = await analyzeImageFull(
            base64Image,
            profiles,
            OPENAI_API_KEY
          );
          return res.json(result);
        } catch (aiError) {
          console.error("OpenAI OCR failed, falling back to mock:", aiError);
        }
      }

      // Fallback: run mock ingredient text through the real engine
      const mockText =
        "Wheat flour, Sugar, Milk, Eggs, Salt, Vegetable oil, " +
        "Natural flavors, Soy lecithin, Modified corn starch, " +
        "Sodium benzoate, MSG, Artificial colors (Red 40). " +
        "Contains: wheat, milk, eggs, soy.";
      const result = analyzeExtractedText(mockText, profiles);
      result._isMock = true;
      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // ─── Text-Only Analysis (for barcode products, manual input) ───
  app.post("/api/analyze-text", async (req, res) => {
    try {
      const { text, profiles } = req.body;

      if (!text || !profiles || !Array.isArray(profiles)) {
        return res
          .status(400)
          .json({ error: "text and profiles are required" });
      }

      const result = analyzeExtractedText(text, profiles);
      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing text:", error);
      res.status(500).json({ error: "Failed to analyze text" });
    }
  });

  // Menu analysis endpoint for restaurant menus
  app.post("/api/analyze-menu", async (req, res) => {
    try {
      const { base64Image, profile } = req.body;

      if (!base64Image || !profile) {
        return res.status(400).json({ error: "base64Image and profile are required" });
      }

      if (OPENAI_API_KEY) {
        try {
          const systemPrompt = buildMenuAnalysisPrompt(profile);
          const aiResult = await analyzeImageWithOpenAI(base64Image, systemPrompt);
          return res.json(aiResult);
        } catch (aiError) {
          console.error("OpenAI menu analysis failed:", aiError);
        }
      }

      // Mock menu analysis response
      res.json({
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
              { type: "allergy_risk", conflict: "Dairy", detail: "Contains cream and parmesan cheese" },
              { type: "allergy_risk", conflict: "Eggs", detail: "Traditional carbonara contains eggs" }
            ]
          }
        ]
      });
    } catch (error: any) {
      console.error("Error analyzing menu:", error);
      res.status(500).json({ error: "Failed to analyze menu" });
    }
  });

  // Dish suggestions endpoint using GPT
  app.post("/api/dish-suggestions", async (req, res) => {
    try {
      const { restaurantName, allergies, preferences } = req.body;

      if (!restaurantName) {
        return res.status(400).json({ error: "Restaurant name is required" });
      }

      if (OPENAI_API_KEY) {
        try {
          const suggestions = await generateDishSuggestionsWithOpenAI(
            restaurantName,
            allergies || "",
            preferences || ""
          );
          return res.json({ suggestions });
        } catch (aiError) {
          console.error("OpenAI dish suggestions failed, using fallback:", aiError);
        }
      }

      // Fallback to local suggestions
      const suggestions = generateMockSuggestions(restaurantName, allergies, preferences);
      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error generating dish suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // Recipe generation endpoint
  app.post("/api/generate-recipe", async (req, res) => {
    try {
      const { preference, allergies, dietaryPreferences, profileNames } = req.body;

      if (!preference) {
        return res.status(400).json({ error: "Recipe preference is required" });
      }

      if (OPENAI_API_KEY) {
        try {
          const prompt = buildRecipeGenerationPrompt(preference, allergies || [], dietaryPreferences || [], profileNames || []);
          const recipe = await generateRecipeWithOpenAI(prompt);
          recipe.generatedFor = profileNames || [];
          return res.json({ recipe });
        } catch (aiError) {
          console.error("OpenAI recipe generation failed:", aiError);
        }
      }

      // Fallback to mock recipe
      const mockRecipe = generateMockRecipe(preference, allergies || [], profileNames || []);
      res.json({ recipe: mockRecipe });
    } catch (error: any) {
      console.error("Error generating recipe:", error);
      res.status(500).json({ error: "Failed to generate recipe" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

function generateMockSuggestions(
  restaurantName: string,
  allergies: string,
  preferences: string
): string[] {
  const isVegetarian = preferences.toLowerCase().includes("vegetarian");
  const isVegan = preferences.toLowerCase().includes("vegan");
  const hasGluten = allergies.toLowerCase().includes("gluten");
  const hasDairy = allergies.toLowerCase().includes("dairy");
  const hasPeanuts = allergies.toLowerCase().includes("peanut");

  if (isVegan) {
    return [
      `Roasted vegetable Buddha bowl - Assorted roasted vegetables with tahini dressing, safe for your dietary needs`,
      `Mushroom and spinach risotto (dairy-free) - Creamy rice dish made with plant-based cream`,
      `Thai vegetable curry with coconut rice - Aromatic curry with fresh vegetables and coconut milk`,
      `Grilled portobello mushroom steak - Marinated mushroom with herb sauce and roasted potatoes`,
      `Mediterranean falafel plate - Crispy falafel with hummus, fresh vegetables, and warm pita`,
    ];
  }

  if (isVegetarian) {
    const suggestions = [
      `Caprese salad - Fresh mozzarella with vine-ripened tomatoes and basil drizzle`,
      `Vegetable lasagna - Layered pasta with ricotta cheese and seasonal vegetables`,
      `Spinach and ricotta ravioli - Handmade pasta with sage butter sauce`,
      `Eggplant parmesan - Breaded eggplant with marinara and melted cheese`,
      `Greek salad with feta - Crisp vegetables with Kalamata olives and feta cheese`,
    ];
    return hasDairy 
      ? suggestions.map(s => s.replace(/mozzarella|ricotta|feta|cheese/gi, "dairy-free alternative"))
      : suggestions;
  }

  if (hasGluten) {
    return [
      `Grilled ribeye steak with potato puree - Premium steak with creamy mashed potatoes (gluten-free)`,
      `Pan-seared salmon - Fresh Atlantic salmon with lemon butter and steamed vegetables`,
      `Herb-roasted chicken - Free-range chicken with roasted root vegetables`,
      `Shrimp scampi with rice - Garlic butter shrimp served over fluffy rice (no pasta)`,
      `Lamb chops with mint sauce - Tender lamb with fresh mint and grilled asparagus`,
    ];
  }

  return [
    `Grilled salmon with roasted vegetables - Fresh Atlantic salmon with seasonal vegetables, no common allergens`,
    `Mediterranean quinoa bowl - Quinoa with cherry tomatoes, cucumbers, olives, and herb dressing`,
    `Herb-crusted chicken breast - Tender chicken with fresh herbs and steamed broccoli`,
    `Shrimp stir-fry with jasmine rice - Sautéed shrimp with vegetables in a light garlic sauce`,
    `Fresh garden salad with grilled tofu - Mixed greens with marinated tofu and balsamic vinaigrette`,
  ];
}

async function generateDishSuggestionsWithOpenAI(
  restaurantName: string,
  allergies: string,
  preferences: string
): Promise<string[]> {
  const prompt = `You are a food safety assistant for Appergy, a food allergy app.

A user is dining at "${restaurantName}".

**User's food allergies:** ${allergies || "None specified"}
**User's dietary preferences:** ${preferences || "None specified"}

Based on the restaurant name, infer what type of cuisine they likely serve (e.g. Italian, Mexican, Japanese, American, etc.).

Then suggest 5 specific menu items that:
1. Are commonly found at this type of restaurant
2. Are safe for the user's allergies
3. Match their dietary preferences
4. Include a brief note about what to ask the server to confirm

Format each item as: "Dish Name - Why it's safe + any modifications to request"

Return ONLY a JSON array of 5 strings.
Example: ["Grilled Salmon with Vegetables - Naturally gluten-free and dairy-free, ask server to confirm no butter is used", ...]`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

  // Parse JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  // Fallback: split by newlines if not valid JSON
  return text.split("\n").filter((line: string) => line.trim().length > 5).slice(0, 5);
}

function buildRecipeGenerationPrompt(preference: string, allergies: string[], dietaryPreferences: string[], profileNames: string[]): string {
  return `You are a professional chef creating recipes for people with food allergies and dietary restrictions.

**User Request:** ${preference}

**Must Avoid (Allergies/Restrictions):**
${allergies.length > 0 ? allergies.join(', ') : 'None specified'}

**Dietary Preferences:**
${dietaryPreferences.length > 0 ? dietaryPreferences.join(', ') : 'None specified'}

**Cooking for:** ${profileNames.length > 0 ? profileNames.join(', ') : 'User'}

**Task:** Create a delicious, safe recipe that:
1. Matches the user's request/cuisine preference
2. COMPLETELY AVOIDS all listed allergens and restrictions
3. Respects dietary preferences where possible
4. Uses common, accessible ingredients
5. Provides clear, easy-to-follow instructions

**Output Format (JSON only, no markdown):**
{
  "title": "Recipe Name",
  "description": "A brief appetizing description of the dish",
  "prepTime": "XX minutes",
  "cookTime": "XX minutes",
  "servings": 4,
  "difficulty": "Easy",
  "cuisine": "Italian",
  "ingredients": [
    {"item": "ingredient name", "amount": "1 cup"},
    {"item": "another ingredient", "amount": "2 tablespoons"}
  ],
  "instructions": [
    "First step of the recipe",
    "Second step of the recipe"
  ],
  "allergenNotes": "Confirmation that recipe avoids all listed allergens",
  "substitutionTips": ["Optional tip 1", "Optional tip 2"]
}

Important: 
- Ensure the recipe is completely safe for the user's allergies. Double-check every ingredient.
- Extract the cuisine type from the user's request (e.g., Italian, Mexican, Asian, American, Mediterranean)
- Set difficulty based on complexity: Easy (under 30 min, simple techniques), Medium (30-60 min), Hard (over 60 min or advanced techniques)`;
}

async function generateRecipeWithOpenAI(prompt: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate the recipe as specified. Return only valid JSON.' },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('Failed to parse recipe response');
}

function generateMockRecipe(preference: string, allergies: string[], profileNames: string[]): any {
  const recipes: Record<string, any> = {
    pasta: {
      title: "Allergen-Free Pasta Primavera",
      description: "A colorful and vibrant pasta dish loaded with fresh vegetables, tossed in olive oil and garlic.",
      prepTime: "15 minutes",
      cookTime: "20 minutes",
      servings: 4,
      difficulty: "Easy",
      cuisine: "Italian",
      ingredients: [
        { item: "gluten-free pasta", amount: "12 oz" },
        { item: "olive oil", amount: "2 tablespoons" },
        { item: "garlic, minced", amount: "2 cloves" },
        { item: "cherry tomatoes, halved", amount: "1 cup" },
        { item: "zucchini, sliced", amount: "1 medium" },
        { item: "bell pepper, diced", amount: "1 medium" },
        { item: "fresh spinach", amount: "1 cup" },
        { item: "salt and pepper", amount: "to taste" },
        { item: "fresh basil", amount: "for garnish" }
      ],
      instructions: [
        "Cook pasta according to package directions. Drain and set aside.",
        "Heat olive oil in a large skillet over medium heat.",
        "Add garlic and cook for 1 minute until fragrant.",
        "Add zucchini and bell pepper, cook for 5 minutes.",
        "Add cherry tomatoes and cook for 3 more minutes.",
        "Toss in cooked pasta and spinach, stir until wilted.",
        "Season with salt and pepper, garnish with fresh basil."
      ],
      allergenNotes: "This recipe is gluten-free and dairy-free.",
      substitutionTips: ["Use regular pasta if gluten is not a concern", "Add grilled chicken for extra protein"],
      generatedFor: profileNames
    },
    default: {
      title: "Simple Safe Stir-Fry",
      description: "A quick and healthy stir-fry with crisp vegetables and your choice of protein in a savory sauce.",
      prepTime: "10 minutes",
      cookTime: "15 minutes",
      servings: 4,
      difficulty: "Easy",
      cuisine: "Asian",
      ingredients: [
        { item: "mixed vegetables (broccoli, carrots, snap peas)", amount: "2 cups" },
        { item: "protein of choice (chicken, tofu, or shrimp)", amount: "1 lb" },
        { item: "olive oil", amount: "3 tablespoons" },
        { item: "garlic, minced", amount: "2 cloves" },
        { item: "fresh ginger, grated", amount: "1 inch" },
        { item: "coconut aminos (soy-free)", amount: "3 tablespoons" },
        { item: "rice vinegar", amount: "1 tablespoon" },
        { item: "cooked rice", amount: "for serving" }
      ],
      instructions: [
        "Cut protein into bite-sized pieces and vegetables into uniform sizes.",
        "Heat 2 tablespoons oil in a wok or large skillet over high heat.",
        "Cook protein until done, about 5-7 minutes. Remove and set aside.",
        "Add remaining oil, then garlic and ginger. Cook 30 seconds.",
        "Add vegetables and stir-fry for 4-5 minutes until crisp-tender.",
        "Return protein to pan, add coconut aminos and rice vinegar.",
        "Toss everything together and serve over rice."
      ],
      allergenNotes: "This recipe uses coconut aminos instead of soy sauce to avoid soy allergens.",
      substitutionTips: ["Use tamari if soy is not a concern", "Swap rice for cauliflower rice for low-carb option"],
      generatedFor: profileNames
    }
  };

  const lowerPref = preference.toLowerCase();
  if (lowerPref.includes("pasta") || lowerPref.includes("italian")) {
    return recipes.pasta;
  }
  return recipes.default;
}
