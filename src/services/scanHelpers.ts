export interface MenuLine {
  rawText: string;
  normalized?: string[];
  confidence?: number;
}

export interface AllergenMatch {
  allergenId: string;
  severity: number; // 0..1
  matches: string[];
}

export interface AnalysisResult {
  menuItems: MenuLine[];
  allergensDetected: AllergenMatch[];
  dietaryFlags: string[];
  confidence: number; // 0..1
}

export function normalizeTokens(tokens: string[]): string[] {
  return tokens
    .map((t) =>
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
    )
    .filter(Boolean);
}

export function quickHeuristicScan(text: string, userAllergens: string[] = []): AnalysisResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const menuItems: MenuLine[] = lines.map((l) => ({ rawText: l, normalized: normalizeTokens(l.split(/\s+/)), confidence: 0.6 }));

  const lower = text.toLowerCase();
  const allergensDetected: AllergenMatch[] = [];

  // simple substring matching for quick heuristic
  for (const a of userAllergens) {
    const key = a.toLowerCase();
    if (lower.includes(key)) {
      allergensDetected.push({ allergenId: a, severity: 0.9, matches: [a] });
    }
  }

  const confidence = allergensDetected.length > 0 ? 0.85 : 0.5;

  return { menuItems, allergensDetected, dietaryFlags: [], confidence };
}

export function mergeAnalysis(local: Partial<AnalysisResult>, server: Partial<AnalysisResult>): AnalysisResult {
  const menuItems = server.menuItems ?? local.menuItems ?? [];
  const allergensDetected = server.allergensDetected ?? local.allergensDetected ?? [];
  const dietaryFlags = server.dietaryFlags ?? local.dietaryFlags ?? [];
  const confidence = Math.max(server.confidence ?? 0, local.confidence ?? 0);

  return {
    menuItems,
    allergensDetected,
    dietaryFlags,
    confidence,
  };
}

// Compute a stable fingerprint for an item using precedence: confirmedName > guessedName
export function computeItemFingerprint(confirmedName?: string | null, guessedName?: string | null): string | null {
  const source = (confirmedName && confirmedName.trim()) || (guessedName && guessedName.trim());
  if (!source) return null;
  const normalized = normalizeTokens([source]).join('-');
  if (!normalized) return null;
  return `fp:${normalized}`;
}

// Update session counters for attempts and manual review escalation
export function updateSessionAttemptCounters(session: { attemptCount?: number; manualReviewCount?: number; escalationShown?: boolean }, isMRR: boolean) {
  const attemptCount = (session.attemptCount ?? 0) + 1;
  let manualReviewCount = session.manualReviewCount ?? 0;
  if (isMRR) {
    manualReviewCount += 1;
  } else {
    manualReviewCount = 0;
  }
  const escalationShown = session.escalationShown ?? false;
  const shouldShowEscalation = !escalationShown && manualReviewCount >= 3;

  return { attemptCount, manualReviewCount, escalationShown: escalationShown || shouldShowEscalation, shouldShowEscalation };
}

// Apply a user's override payload to an analysis result
export function applyUserOverrideToResult(result: AnalysisResult, overridePayload: Partial<AnalysisResult>): AnalysisResult {
  const merged = mergeAnalysis(result, overridePayload);

  // mark corrected findings as user_corrected via adding a dietaryFlag (lightweight)
  if (overridePayload.allergensDetected && overridePayload.allergensDetected.length > 0) {
    merged.dietaryFlags = Array.from(new Set([...(merged.dietaryFlags ?? []), 'user_corrected']));
  }

  return merged;
}

// Only create admin alerts when allergen data is present (not preferences-only)
export function shouldCreateAdminAlert(result: AnalysisResult): boolean {
  return Array.isArray(result.allergensDetected) && result.allergensDetected.length > 0;
}

export default {
  normalizeTokens,
  quickHeuristicScan,
  mergeAnalysis,
  computeItemFingerprint,
  updateSessionAttemptCounters,
  applyUserOverrideToResult,
  shouldCreateAdminAlert,
};
