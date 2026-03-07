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

  return `You are an AI assistant for a food allergy app called Appergy. Analyze a restaurant menu image, extract menu items, and assess allergen risk for this user.

**User Profile:**
Allergies: ${allAllergies.join(", ") || "None"}
Preferences: ${(profile.preferences || []).join(", ") || "None"}
Forbidden Keywords: ${(profile.forbiddenKeywords || []).join(", ") || "None"}

**Instructions:**
1. Extract every menu item visible in the image.
2. For each ingredient, set source to:
   - "explicit" — the ingredient or allergen is directly stated on the menu (in the description, allergen note, etc.)
   - "inferred" — you are inferring the ingredient from the dish name or cuisine type
3. An "inferred" ingredient MUST NOT produce a verdict of "Unsafe". It can produce "Caution" with a note that confirmation is required.
4. Only "explicit" ingredients can produce an "Unsafe" verdict.
5. Cross-reference against the user's allergies, preferences, and forbidden keywords.

**Output Format (JSON only — no markdown):**
{
  "menu_items": [
    {
      "name": "Item name",
      "description": "Description from menu",
      "price": "Price if visible or null",
      "ingredients": [
        { "name": "butter", "source": "inferred" },
        { "name": "wheat", "source": "explicit" }
      ],
      "verdict": "Safe" | "Caution" | "Unsafe",
      "confidence": "high" | "medium" | "low",
      "conflicts": [
        {
          "type": "allergy_risk" | "preference_mismatch" | "forbidden_keyword",
          "ingredient": "The specific ingredient",
          "source": "explicit" | "inferred",
          "detail": "Explanation"
        }
      ]
    }
  ]
}

Critical rules:
- NEVER mark an item Unsafe based solely on inferred ingredients.
- Always label inferred ingredients clearly so the UI can warn the user.
- Common allergens to check: milk, eggs, peanuts, tree nuts, fish, shellfish, wheat, soy, sesame.`;
}

async function analyzeImageWithOpenAI(base64Image: string, systemPrompt: string, apiKey: string): Promise<any> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // gpt-4o for menu analysis — better at reading dense menu text and
      // reasoning about cuisine-specific ingredients than gpt-4o-mini.
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this menu image and return structured JSON only.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  const jsonMatch = content.replace(/```json\s*|```\s*/g, "").match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("Failed to parse AI menu response");
}


import {
  analyzeImageFull,
  analyzeExtractedText,
  extractTextFromImage,
} from "./services/analysis";
import { requireAuth } from "./middleware/requireAuth";
import { requireAppCheck } from "./middleware/requireAppCheck";
import { getSubscriberEntitlements } from "./lib/revenueCat";
import { getAdminApp } from "./lib/firebaseAdmin";
import { createUserRateLimiter } from "./middleware/requireUserRateLimit";

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

  // ─── Gate 3: Per-user AI rate limit (Firestore counter, fixed hourly window) ───
  // Applied only to the 6 AI routes below; /api/subscription/verify is excluded.
  const aiRateLimit = createUserRateLimiter(
    Number(process.env.AI_RATE_LIMIT_HOURLY) || 20,
  );

  // ─── OCR Only: Extract text from image (no analysis) ───
  app.post("/api/ocr", aiRateLimit, async (req, res) => {
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
  app.post("/api/analyze-image", aiRateLimit, async (req, res) => {
    // uid comes from the verified Firebase token set by requireAuth — never from req.body
    const uid = res.locals.uid as string;
    try {
      const { base64Image, profiles, productName } = req.body;

      if (!base64Image || !profiles || !Array.isArray(profiles)) {
        return res
          .status(400)
          .json({ error: "base64Image and profiles are required" });
      }

      if (!OPENAI_API_KEY) {
        return res.status(503).json({ error: "Analysis service not configured" });
      }

      const result = await analyzeImageFull(base64Image, profiles, OPENAI_API_KEY);

      // Write scan history server-side via Admin SDK so the client never has
      // write access to scanHistory — prevents fabricated results.
      let scanId: string | null = null;
      try {
        const adminDb = getAdminApp().firestore();
        const safeCount = result.results.filter((r) => r.safe).length;
        const unsafeCount = result.results.filter((r) => !r.safe).length;
        const docRef = await adminDb.collection(`users/${uid}/scanHistory`).add({
          timestamp: new Date().toISOString(),
          type: "camera",
          productName: productName ?? null,
          ingredients: result.ingredients,
          safeCount,
          unsafeCount,
          reviewRequired: result.reviewRequired ?? false,
          confidenceScore: result.confidenceScore ?? null,
          confidenceLevel: result.confidenceLevel ?? null,
          familyChecked: result.results.length > 1,
          checkedProfileNames: result.results.map((r) => r.name),
          results: result.results.map((r) => ({
            profileId: r.profileId,
            name: r.name,
            safe: r.safe,
            status: r.status,
            reasons: r.reasons,
          })),
        });
        scanId = docRef.id;
      } catch (historyErr) {
        // Non-fatal — analysis result is returned even if history save fails
        console.error("Failed to save scan history:", { uid, historyErr });
      }

      res.json({ ...result, scanId });
    } catch (error: any) {
      console.error("Error analyzing image:", { uid, error });
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // ─── Text-Only Analysis (for barcode products, manual input) ───
  app.post("/api/analyze-text", aiRateLimit, async (req, res) => {
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
  app.post("/api/analyze-menu", aiRateLimit, async (req, res) => {
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
  app.post("/api/dish-suggestions", aiRateLimit, async (req, res) => {
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
  app.post("/api/generate-recipe", aiRateLimit, async (req, res) => {
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

  // ─── Subscription: verify entitlements via RevenueCat REST API & sync to Firestore ───
  app.post("/api/subscription/verify", async (req, res) => {
    const uid = res.locals.uid as string;
    try {
      const secretKey = process.env.REVENUECAT_SECRET_KEY;
      if (!secretKey) {
        return res
          .status(503)
          .json({ error: "Subscription service not configured" });
      }

      const subscription = await getSubscriberEntitlements(uid, secretKey);

      // Sync verified status to Firestore so security rules / other services
      // can gate on it without calling RevenueCat on every request.
      const adminDb = getAdminApp().firestore();
      await adminDb.doc(`users/${uid}`).set(
        {
          subscription: {
            tier: subscription.tier,
            isActive: subscription.isActive,
            expiresAt: subscription.expiresAt ?? null,
            verifiedAt: new Date().toISOString(),
          },
        },
        { merge: true }
      );

      res.json(subscription);
    } catch (error: any) {
      console.error("Error verifying subscription:", { uid, error });
      res.status(500).json({ error: "Failed to verify subscription" });
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

