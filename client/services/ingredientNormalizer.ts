/*
 * Ingredient Normalizer
 *
 * Cleans and structures raw OCR text from food labels.
 * Handles messy formatting, parentheticals, "Contains:" sections, etc.
 */

export interface ParsedLabel {
  /** All individual ingredient tokens, cleaned and lowercase */
  ingredients: string[];
  /** Raw text of the ingredients section */
  ingredientsRawText: string;
  /** Items listed after "Contains:" (high confidence allergens) */
  containsStatements: string[];
  /** Items listed after "May contain:" (cross-contamination risk) */
  mayContainStatements: string[];
  /** Full normalized text for display */
  normalizedText: string;
  /** Section boundaries in the raw text for highlighting */
  sections: {
    ingredients?: { start: number; end: number };
    contains?: { start: number; end: number };
    mayContain?: { start: number; end: number };
  };
}

/**
 * Normalize and parse raw OCR text from a food label.
 */
export function parseIngredientLabel(rawText: string): ParsedLabel {
  const normalizedText = normalizeText(rawText);
  const sections = detectSections(normalizedText);

  const ingredientsRaw = sections.ingredientsText || normalizedText;
  const ingredients = splitIngredients(ingredientsRaw);

  const containsStatements = sections.containsText
    ? splitSimpleList(sections.containsText)
    : [];

  const mayContainStatements = sections.mayContainText
    ? splitSimpleList(sections.mayContainText)
    : [];

  return {
    ingredients,
    ingredientsRawText: ingredientsRaw,
    containsStatements,
    mayContainStatements,
    normalizedText,
    sections: sections.boundaries,
  };
}

function normalizeText(text: string): string {
  return (
    text
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
      .replace(/[''`]/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
  );
}

interface SectionResult {
  ingredientsText: string | null;
  containsText: string | null;
  mayContainText: string | null;
  boundaries: {
    ingredients?: { start: number; end: number };
    contains?: { start: number; end: number };
    mayContain?: { start: number; end: number };
  };
}

function detectSections(text: string): SectionResult {
  const lower = text.toLowerCase();
  const result: SectionResult = {
    ingredientsText: null,
    containsText: null,
    mayContainText: null,
    boundaries: {},
  };

  // Find "May contain" first
  const mayContainPatterns = [
    /may contain[s]?\s*[:.]?\s*/gi,
    /produced in a facility that (?:also )?(?:processes|handles|uses)\s*[:.]?\s*/gi,
  ];

  for (const pattern of mayContainPatterns) {
    const match = pattern.exec(lower);
    if (match) {
      const start = match.index + match[0].length;
      const end = findNextSectionStart(lower, start) || text.length;
      result.mayContainText = text.substring(start, end).trim();
      result.boundaries.mayContain = { start, end };
      break;
    }
  }

  // Find "Contains:" (allergen declaration)
  const containsPatterns = [
    /[.;]\s*contains\s*[:]\s*/gi,
    /\bcontains\s*[:]\s*/gi,
    /\ballergens?\s*[:]\s*/gi,
  ];

  for (const pattern of containsPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(lower);
    if (match) {
      const before = lower.substring(Math.max(0, match.index - 5), match.index);
      if (before.includes("may")) continue;

      const start = match.index + match[0].length;
      const end =
        result.boundaries.mayContain?.start ||
        findNextSectionStart(lower, start) ||
        text.length;
      result.containsText = text.substring(start, end).trim();
      result.boundaries.contains = { start, end };
      break;
    }
  }

  // Find "Ingredients:"
  const ingredientsPatterns = [/ingredients\s*[:]\s*/gi];

  for (const pattern of ingredientsPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(lower);
    if (match) {
      const start = match.index + match[0].length;
      const end =
        result.boundaries.contains?.start ||
        result.boundaries.mayContain?.start ||
        findNextSectionStart(lower, start) ||
        text.length;
      result.ingredientsText = text.substring(start, end).trim();
      result.boundaries.ingredients = { start, end };
      break;
    }
  }

  return result;
}

function findNextSectionStart(
  lowerText: string,
  after: number
): number | null {
  const pattern =
    /[.;]?\s*\b(ingredients|contains|may contain|allergen|nutrition facts|serving size|calories|distributed by|manufactured by)\s*[:]/g;

  pattern.lastIndex = after + 1;
  const match = pattern.exec(lowerText);
  return match ? match.index : null;
}

function splitIngredients(text: string): string[] {
  const results: string[] = [];
  const expanded = expandParentheticals(text);
  const parts = expanded
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    const andOrParts = part.split(/\band[/]or\b|\band\b/i);
    for (const subPart of andOrParts) {
      const cleaned = cleanIngredientToken(subPart);
      if (cleaned.length > 0) {
        results.push(cleaned);
      }
    }
  }

  return results;
}

function expandParentheticals(text: string): string {
  let result = text;
  result = result.replace(
    /([^,(]+?)\s*\(([^)]+)\)/g,
    (_match, parent, inside) => `${parent.trim()}, ${inside}`
  );
  result = result.replace(
    /([^,[\]]+?)\s*\[([^\]]+)\]/g,
    (_match, parent, inside) => `${parent.trim()}, ${inside}`
  );
  return result;
}

function cleanIngredientToken(token: string): string {
  return token
    .replace(/^[.\s*•·-]+|[.\s*•·-]+$/g, "")
    .replace(/\s*\d+(\.\d+)?%?\s*$/, "")
    .replace(/^less than \d+(\.\d+)?%?\s*(of\s*)?/i, "")
    .replace(/^\d+(\.\d+)?%?\s*or less\s*(of\s*)?[:.]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitSimpleList(text: string): string[] {
  return text
    .split(/[,;]|\band\b/i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.length < 50);
}

/**
 * Find the character positions of a term within raw text.
 * Returns all occurrences as {start, end} spans.
 */
export function findEvidenceSpans(
  rawText: string,
  searchTerm: string
): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  const lowerText = rawText.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();

  let pos = 0;
  while (pos < lowerText.length) {
    const idx = lowerText.indexOf(lowerTerm, pos);
    if (idx === -1) break;

    const charBefore = idx > 0 ? lowerText[idx - 1] : " ";
    const charAfter =
      idx + lowerTerm.length < lowerText.length
        ? lowerText[idx + lowerTerm.length]
        : " ";

    const isBoundaryBefore = /[\s,;:([\]./\-]/.test(charBefore);
    const isBoundaryAfter = /[\s,;:)\]./\-]/.test(charAfter);

    if (isBoundaryBefore && isBoundaryAfter) {
      spans.push({ start: idx, end: idx + lowerTerm.length });
    }

    pos = idx + 1;
  }

  return spans;
}
