/**
 * Server-Side Analysis Service
 *
 * Two-phase pipeline:
 *   Phase 1 — AI reads the image and extracts raw ingredient text (OCR).
 *   Phase 2 — Deterministic rule engine checks for allergens, dietary, keywords.
 *
 * The AI never decides safety — only the rule engine does.
 */

import { parseIngredientLabel } from "../../client/services/ingredientNormalizer";
import {
  evaluateLabelForProfiles,
  type UserProfile,
} from "../../client/services/policyEngine";
import type {
  ProfileInfo,
  AnalysisResult,
  ProfileResult,
  MatchedIngredient,
} from "../../shared/types";

// ─── Phase 1: OpenAI Vision OCR ───

const OCR_SYSTEM_PROMPT = `You are an OCR system for food product labels. Your ONLY job is to read text from the image.

INSTRUCTIONS:
1. Read ALL text from the ingredient label, "Contains:", and "May contain:" sections.
2. Return the text EXACTLY as printed on the label — do not interpret, summarize, or modify it.
3. If the image shows a restaurant menu instead of a product label, extract each dish name with its description.
4. If you cannot read the text clearly, return what you can read and note any unclear parts.

OUTPUT FORMAT (JSON only):
{
  "type": "ingredient_label" | "menu" | "unreadable",
  "raw_text": "The complete text from the ingredient/allergen sections, exactly as printed",
  "contains_statement": "Text from any 'Contains:' line, or null",
  "may_contain_statement": "Text from any 'May contain:' line, or null",
  "confidence": "high" | "medium" | "low",
  "notes": "Any issues with readability, or null"
}

IMPORTANT:
- Do NOT analyze allergens or safety. Just read the text.
- Preserve original spelling, punctuation, and formatting.
- Include sub-ingredients in parentheses exactly as shown.
- If the image is not a food label or menu, set type to "unreadable".`;

interface OCRResult {
  type: "ingredient_label" | "menu" | "unreadable";
  raw_text: string;
  contains_statement: string | null;
  may_contain_statement: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
}

export async function extractTextFromImage(
  base64Image: string,
  apiKey: string
): Promise<OCRResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Read all ingredient and allergen text from this food label image. Return JSON only.",
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
      max_tokens: 1500,
      temperature: 0.1, // Very low temp for accurate OCR
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  // Parse JSON from response (handle markdown code blocks)
  const cleaned = content.replace(/```json\s*|```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // If no JSON, treat the whole response as raw text
    return {
      type: "ingredient_label",
      raw_text: content.trim(),
      contains_statement: null,
      may_contain_statement: null,
      confidence: "low",
      notes: "Could not parse structured response; using raw text",
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as OCRResult;
  } catch {
    return {
      type: "ingredient_label",
      raw_text: content.trim(),
      contains_statement: null,
      may_contain_statement: null,
      confidence: "low",
      notes: "JSON parse failed; using raw text",
    };
  }
}

// ─── Phase 2: Deterministic Pipeline ───

/**
 * Convert client ProfileInfo to engine UserProfile format.
 */
function toUserProfile(p: ProfileInfo): UserProfile {
  return {
    id: p.id,
    name: p.name,
    allergies: p.allergies || [],
    customAllergies: p.customAllergies || [],
    preferences: p.preferences || [],
    customPreferences: p.customPreferences || [],
    forbiddenKeywords: p.forbiddenKeywords || [],
    treatMayContainAsUnsafe: p.treatMayContainAsUnsafe ?? false,
  };
}

/**
 * Run the deterministic pipeline on extracted text for multiple profiles.
 */
export function analyzeExtractedText(
  rawText: string,
  profiles: ProfileInfo[]
): AnalysisResult {
  // Parse the raw text into structured tokens
  const parsedLabel = parseIngredientLabel(rawText);

  // Convert profiles
  const userProfiles = profiles.map(toUserProfile);

  // Run engine
  const policyResults = evaluateLabelForProfiles(parsedLabel, userProfiles);

  // Convert to backward-compatible AnalysisResult
  const matchedIngredients: MatchedIngredient[] = [];
  const profileResults: ProfileResult[] = [];

  for (const pr of policyResults) {
    const matchedAllergens: string[] = [];
    const matchedKeywords: string[] = [];
    const matchedPreferences: string[] = [];
    const reasons: string[] = [];

    for (const finding of pr.findings) {
      reasons.push(finding.reason);

      if (finding.kind === "ALLERGEN") {
        matchedAllergens.push(finding.matchedText);
        addMatchedIngredient(
          matchedIngredients,
          finding.matchedText,
          "allergen",
          pr.profileId
        );
      } else if (finding.kind === "DIETARY") {
        matchedPreferences.push(
          `${finding.canonicalTerm}: ${finding.matchedText}`
        );
        addMatchedIngredient(
          matchedIngredients,
          finding.matchedText,
          "preference",
          pr.profileId
        );
      } else if (finding.kind === "FORBIDDEN_KEYWORD") {
        matchedKeywords.push(finding.matchedText);
        addMatchedIngredient(
          matchedIngredients,
          finding.matchedText,
          "keyword",
          pr.profileId
        );
      }
    }

    const status =
      pr.status === "UNSAFE"
        ? "unsafe"
        : pr.status === "CAUTION"
          ? "caution"
          : "safe";

    profileResults.push({
      profileId: pr.profileId,
      name: pr.profileName,
      safe: status === "safe",
      status: status as "safe" | "unsafe" | "caution",
      reasons,
      matchedAllergens,
      matchedKeywords,
      matchedPreferences,
    });
  }

  return {
    ingredients: parsedLabel.ingredients,
    results: profileResults,
    matchedIngredients,
    rawExtractedText: rawText,
  };
}

function addMatchedIngredient(
  list: MatchedIngredient[],
  name: string,
  type: "allergen" | "keyword" | "preference",
  profileId: string
) {
  const existing = list.find(
    (m) => m.name.toLowerCase() === name.toLowerCase() && m.type === type
  );
  if (existing) {
    if (!existing.profileIds.includes(profileId)) {
      existing.profileIds.push(profileId);
    }
  } else {
    list.push({ name, type, profileIds: [profileId] });
  }
}

// ─── Combined: OCR + Pipeline ───

/**
 * Full server-side analysis: extract text from image via OpenAI, then run
 * the deterministic engine. Returns a backward-compatible AnalysisResult.
 */
export async function analyzeImageFull(
  base64Image: string,
  profiles: ProfileInfo[],
  apiKey: string
): Promise<AnalysisResult> {
  // Phase 1: OCR
  const ocr = await extractTextFromImage(base64Image, apiKey);

  if (ocr.type === "unreadable" || !ocr.raw_text) {
    // Return empty safe result with a warning
    return {
      ingredients: [],
      results: profiles.map((p) => ({
        profileId: p.id,
        name: p.name,
        safe: true,
        status: "safe" as const,
        reasons: [],
        matchedAllergens: [],
        matchedKeywords: [],
        matchedPreferences: [],
      })),
      matchedIngredients: [],
      rawExtractedText: "",
      warnings: [
        "Could not read ingredient text from the image. Please try again with a clearer photo.",
        ...(ocr.notes ? [ocr.notes] : []),
      ],
    };
  }

  // Reconstruct full label text including Contains/May contain
  let fullText = ocr.raw_text;
  if (
    ocr.contains_statement &&
    !fullText.toLowerCase().includes("contains:")
  ) {
    fullText += `\nContains: ${ocr.contains_statement}`;
  }
  if (
    ocr.may_contain_statement &&
    !fullText.toLowerCase().includes("may contain")
  ) {
    fullText += `\nMay contain: ${ocr.may_contain_statement}`;
  }

  // Phase 2: Deterministic analysis
  const result = analyzeExtractedText(fullText, profiles);

  // Attach warnings
  const warnings: string[] = [];
  if (ocr.confidence === "low") {
    warnings.push(
      "Low confidence in text extraction. Some ingredients may have been misread."
    );
  }
  if (ocr.confidence === "medium") {
    warnings.push(
      "Some text was partially unclear. Please verify the results."
    );
  }
  if (ocr.notes) {
    warnings.push(ocr.notes);
  }

  return {
    ...result,
    rawExtractedText: fullText,
    ocrConfidence: ocr.confidence,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
