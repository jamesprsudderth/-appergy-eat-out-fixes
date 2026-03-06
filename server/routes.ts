import type { Express } from "express";
import { createServer, type Server } from "node:http";


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

async function analyzeImageWithOpenAI(base64Image: string, systemPrompt: string, apiKey: string): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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


import {
  analyzeImageFull,
  analyzeExtractedText,
  extractTextFromImage,
} from "./services/analysis";
import { requireAuth } from "./middleware/requireAuth";
import { requireAppCheck } from "./middleware/requireAppCheck";

export async function registerRoutes(
  app: Express,
  { openaiApiKey }: { openaiApiKey: string },
): Promise<Server> {
  const OPENAI_API_KEY = openaiApiKey;

  // ─── Gate 1: App Check — attests the request comes from a genuine app binary ───
  // Skipped in NODE_ENV=development so Expo Go / simulators work locally.
  app.use("/api", requireAppCheck);

  // ─── Gate 2: Auth — verifies the individual user's Firebase ID token ───
  app.use("/api", requireAuth);

  // ─── OCR Only: Extract text from image (no analysis) ───
  app.post("/api/ocr", async (req, res) => {
    // uid comes from the verified Firebase token set by requireAuth — never from req.body
    const uid = res.locals.uid as string;
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
      console.error("Error in OCR:", { uid, error });
      res.status(500).json({ error: "Failed to extract text" });
    }
  });

  // ─── Image Analysis: OCR + Deterministic Pipeline ───
  app.post("/api/analyze-image", async (req, res) => {
    // uid comes from the verified Firebase token set by requireAuth — never from req.body
    const uid = res.locals.uid as string;
    try {
      const { base64Image, profiles } = req.body;

      if (!base64Image || !profiles || !Array.isArray(profiles)) {
        return res
          .status(400)
          .json({ error: "base64Image and profiles are required" });
      }

      if (!OPENAI_API_KEY) {
        return res.status(503).json({ error: "Analysis service not configured" });
      }

      const result = await analyzeImageFull(base64Image, profiles, OPENAI_API_KEY);
      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing image:", { uid, error });
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // ─── Text-Only Analysis (for barcode products, manual input) ───
  app.post("/api/analyze-text", async (req, res) => {
    // uid comes from the verified Firebase token set by requireAuth — never from req.body
    const uid = res.locals.uid as string;
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
      console.error("Error analyzing text:", { uid, error });
      res.status(500).json({ error: "Failed to analyze text" });
    }
  });

  // ─── Menu Analysis ───
  app.post("/api/analyze-menu", async (req, res) => {
    // uid comes from the verified Firebase token set by requireAuth — never from req.body
    const uid = res.locals.uid as string;
    try {
      const { base64Image, profile } = req.body;

      if (!base64Image || !profile) {
        return res.status(400).json({ error: "base64Image and profile are required" });
      }

      if (!OPENAI_API_KEY) {
        return res.status(503).json({ error: "Analysis service not configured" });
      }

      const systemPrompt = buildMenuAnalysisPrompt(profile);
      const aiResult = await analyzeImageWithOpenAI(base64Image, systemPrompt, OPENAI_API_KEY);
      res.json(aiResult);
    } catch (error: any) {
      console.error("Error analyzing menu:", { uid, error });
      res.status(500).json({ error: "Failed to analyze menu" });
    }
  });

  // ─── Dish Suggestions ───
  app.post("/api/dish-suggestions", async (req, res) => {
    // uid comes from the verified Firebase token set by requireAuth — never from req.body
    const uid = res.locals.uid as string;
    try {
      const { restaurantName, allergies, preferences } = req.body;

      if (!restaurantName) {
        return res.status(400).json({ error: "Restaurant name is required" });
      }

      if (!OPENAI_API_KEY) {
        return res.status(503).json({ error: "Suggestions service not configured" });
      }

      const suggestions = await generateDishSuggestionsWithOpenAI(
        restaurantName,
        allergies || "",
        preferences || "",
        OPENAI_API_KEY,
      );
      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error generating dish suggestions:", { uid, error });
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // ─── Recipe Generation ───
  app.post("/api/generate-recipe", async (req, res) => {
    // uid comes from the verified Firebase token set by requireAuth — never from req.body
    const uid = res.locals.uid as string;
    try {
      const { preference, allergies, dietaryPreferences, profileNames } = req.body;

      if (!preference) {
        return res.status(400).json({ error: "Recipe preference is required" });
      }

      if (!OPENAI_API_KEY) {
        return res.status(503).json({ error: "Recipe service not configured" });
      }

      const prompt = buildRecipeGenerationPrompt(preference, allergies || [], dietaryPreferences || [], profileNames || []);
      const recipe = await generateRecipeWithOpenAI(prompt, OPENAI_API_KEY);
      recipe.generatedFor = profileNames || [];
      res.json({ recipe });
    } catch (error: any) {
      console.error("Error generating recipe:", { uid, error });
      res.status(500).json({ error: "Failed to generate recipe" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}


async function generateDishSuggestionsWithOpenAI(
  restaurantName: string,
  allergies: string,
  preferences: string,
  apiKey: string,
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
      "Authorization": `Bearer ${apiKey}`,
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

async function generateRecipeWithOpenAI(prompt: string, apiKey: string): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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

