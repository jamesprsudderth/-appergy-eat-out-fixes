import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { UnsafeIssuesModal } from "@/components/UnsafeIssuesModal";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ProfileResult, SafetyStatus } from "@/services/ai";
import { ScanStackParamList } from "@/navigation/ScanStackNavigator";
import { useAuth } from "@/contexts/AuthContext";
import { saveScanToHistory } from "@/services/scanHistory";
import { completeSession } from "@/services/scanSession";
import { db, isFirebaseConfigured } from "@/services/firebase";

type ResultsScreenRouteProp = RouteProp<ScanStackParamList, "Results">;
type ResultsScreenNavigationProp = NativeStackNavigationProp<
  ScanStackParamList,
  "Results"
>;

function StatusBadge({ status }: { status: SafetyStatus }) {
  const config = {
    safe: {
      color: AppColors.success,
      bg: "#1a3d2e",
      icon: "checkmark-circle" as const,
      label: "SAFE",
    },
    caution: {
      color: AppColors.warning,
      bg: "#3d3a1a",
      icon: "warning" as const,
      label: "CAUTION",
    },
    unsafe: {
      color: AppColors.destructive,
      bg: "#3d1a1a",
      icon: "close-circle" as const,
      label: "UNSAFE",
    },
  };

  const c = config[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon} size={40} color={c.color} />
      <ThemedText style={[styles.statusLabel, { color: c.color }]}>
        {c.label}
      </ThemedText>
    </View>
  );
}

interface ResultCardProps {
  result: ProfileResult;
}

/**
 * Renders a raw ingredient text block with flagged words highlighted.
 * Red = allergen/keyword, yellow = dietary/caution.
 */
function IngredientHighlighter({
  rawText,
  matchedIngredients,
}: {
  rawText: string;
  matchedIngredients: { name: string; type: string }[];
}) {
  if (!rawText || rawText.length === 0) return null;

  // Build a list of spans to highlight
  const highlights: {
    start: number;
    end: number;
    type: string;
  }[] = [];

  const lowerText = rawText.toLowerCase();

  for (const match of matchedIngredients) {
    const term = match.name.toLowerCase();
    let pos = 0;
    while (pos < lowerText.length) {
      const idx = lowerText.indexOf(term, pos);
      if (idx === -1) break;
      highlights.push({
        start: idx,
        end: idx + term.length,
        type: match.type,
      });
      pos = idx + 1;
    }
  }

  // Sort by position and merge overlapping spans
  highlights.sort((a, b) => a.start - b.start);

  // Build text segments
  const segments: { text: string; type: string | null }[] = [];
  let cursor = 0;

  for (const h of highlights) {
    if (h.start < cursor) continue; // skip overlapping
    if (h.start > cursor) {
      segments.push({ text: rawText.substring(cursor, h.start), type: null });
    }
    segments.push({
      text: rawText.substring(h.start, h.end),
      type: h.type,
    });
    cursor = h.end;
  }
  if (cursor < rawText.length) {
    segments.push({ text: rawText.substring(cursor), type: null });
  }

  return (
    <View style={highlightStyles.container}>
      <ThemedText style={highlightStyles.label}>Ingredient Text</ThemedText>
      <View style={highlightStyles.textBlock}>
        <Text style={highlightStyles.baseText}>
          {segments.map((seg, i) => {
            if (!seg.type) {
              return (
                <Text key={i} style={highlightStyles.normalText}>
                  {seg.text}
                </Text>
              );
            }
            const isAllergenOrKeyword =
              seg.type === "allergen" || seg.type === "keyword";
            return (
              <Text
                key={i}
                style={[
                  highlightStyles.highlightedText,
                  {
                    backgroundColor: isAllergenOrKeyword
                      ? AppColors.destructive + "35"
                      : AppColors.warning + "35",
                    color: isAllergenOrKeyword
                      ? AppColors.destructive
                      : AppColors.warning,
                  },
                ]}
              >
                {seg.text}
              </Text>
            );
          })}
        </Text>
      </View>
    </View>
  );
}

const highlightStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.secondaryText,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textBlock: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: AppColors.divider,
  },
  baseText: {
    fontSize: 14,
    lineHeight: 22,
  },
  normalText: {
    color: AppColors.secondaryText,
  },
  highlightedText: {
    fontWeight: "700",
    borderRadius: 3,
    overflow: "hidden",
    paddingHorizontal: 2,
  },
});

function ResultCard({ result }: ResultCardProps) {
  const config = {
    safe: {
      color: AppColors.success,
      bg: "#1a3d2e",
    },
    caution: {
      color: AppColors.warning,
      bg: "#3d3a1a",
    },
    unsafe: {
      color: AppColors.destructive,
      bg: "#3d1a1a",
    },
  };

  const c = config[result.status];

  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: c.bg, borderColor: c.color },
      ]}
    >
      <View style={styles.resultHeader}>
        <View style={[styles.iconCircle, { backgroundColor: c.color + "30" }]}>
          <Ionicons
            name={
              result.status === "safe"
                ? "checkmark-circle"
                : result.status === "caution"
                  ? "warning"
                  : "close-circle"
            }
            size={32}
            color={c.color}
          />
        </View>
        <View style={styles.resultInfo}>
          <ThemedText style={styles.profileName}>{result.name}</ThemedText>
          <ThemedText style={[styles.statusText, { color: c.color }]}>
            {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.resultBody}>
        {result.status === "safe" ? (
          <ThemedText style={styles.safeMessage}>
            No allergens, forbidden keywords, or restricted ingredients
            detected.
          </ThemedText>
        ) : (
          <View style={styles.issuesList}>
            {result.matchedAllergens.length > 0 ? (
              <View style={styles.issueSection}>
                <ThemedText
                  style={[
                    styles.issueSectionTitle,
                    { color: AppColors.destructive },
                  ]}
                >
                  Allergens Found:
                </ThemedText>
                <View style={styles.tagsContainer}>
                  {result.matchedAllergens.map((allergen, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tag,
                        { backgroundColor: AppColors.destructive + "30" },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.tagText,
                          { color: AppColors.destructive },
                        ]}
                      >
                        {allergen}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {result.matchedKeywords.length > 0 ? (
              <View style={styles.issueSection}>
                <ThemedText
                  style={[
                    styles.issueSectionTitle,
                    { color: AppColors.destructive },
                  ]}
                >
                  Forbidden Keywords:
                </ThemedText>
                <View style={styles.tagsContainer}>
                  {result.matchedKeywords.map((keyword, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tag,
                        { backgroundColor: AppColors.destructive + "30" },
                      ]}
                    >
                      <Ionicons
                        name="ban"
                        size={12}
                        color={AppColors.destructive}
                      />
                      <ThemedText
                        style={[
                          styles.tagText,
                          { color: AppColors.destructive },
                        ]}
                      >
                        {keyword}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {result.matchedPreferences.length > 0 ? (
              <View style={styles.issueSection}>
                <ThemedText
                  style={[
                    styles.issueSectionTitle,
                    { color: AppColors.warning },
                  ]}
                >
                  Dietary Conflicts:
                </ThemedText>
                <View style={styles.tagsContainer}>
                  {result.matchedPreferences.map((pref, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tag,
                        { backgroundColor: AppColors.warning + "30" },
                      ]}
                    >
                      <ThemedText
                        style={[styles.tagText, { color: AppColors.warning }]}
                      >
                        {pref}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.reasonsList}>
              {result.reasons.map((reason, index) => (
                <View key={index} style={styles.reasonRow}>
                  <Ionicons name="alert-circle" size={14} color={c.color} />
                  <ThemedText
                    style={[
                      styles.reasonText,
                      { color: AppColors.secondaryText },
                    ]}
                  >
                    {reason}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<ResultsScreenNavigationProp>();
  const route = useRoute<ResultsScreenRouteProp>();
  const { user, isDemoMode, refreshUserProfile } = useAuth();
  const hasSaved = useRef(false);

  const { analysisResult, sessionId } = route.params;

  const [showAddKeywordModal, setShowAddKeywordModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(
    null,
  );
  const [isSavingKeyword, setIsSavingKeyword] = useState(false);
  const [showUnsafeModal, setShowUnsafeModal] = useState(false);
  const hasShownModal = useRef(false);

  const safeCount = analysisResult.results.filter(
    (r) => r.status === "safe",
  ).length;
  const cautionCount = analysisResult.results.filter(
    (r) => r.status === "caution",
  ).length;
  const unsafeCount = analysisResult.results.filter(
    (r) => r.status === "unsafe",
  ).length;

  const overallStatus: SafetyStatus =
    unsafeCount > 0 ? "unsafe" : cautionCount > 0 ? "caution" : "safe";

  const matchedIngredients = analysisResult.matchedIngredients || [];
  const matchedNames = new Set(
    matchedIngredients.map((m) => m.name.toLowerCase()),
  );

  useEffect(() => {
    if (user && !hasSaved.current) {
      hasSaved.current = true;
      saveScanToHistory(user.uid, analysisResult).catch((error) => {
        console.error("Failed to save scan to history:", error);
      });
    }
  }, [user, analysisResult]);

  useEffect(() => {
    if (!hasShownModal.current && (unsafeCount > 0 || cautionCount > 0)) {
      hasShownModal.current = true;
      setTimeout(() => {
        setShowUnsafeModal(true);
      }, 500);
    }
  }, [unsafeCount, cautionCount]);

  const handleScanAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Complete the session before going back to scan
    if (user && sessionId) {
      completeSession(user.uid, sessionId);
    }
    navigation.popToTop();
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Complete the session when user is done
    if (user && sessionId) {
      completeSession(user.uid, sessionId);
    }
    navigation.popToTop();
  };

  const handleAddToKeywords = (ingredient: string) => {
    setSelectedIngredient(ingredient);
    setShowAddKeywordModal(true);
  };

  const confirmAddKeyword = async () => {
    if (!selectedIngredient) return;

    setIsSavingKeyword(true);

    if (isDemoMode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddKeywordModal(false);
      setSelectedIngredient(null);
      setIsSavingKeyword(false);
      return;
    }

    if (!user?.uid || !db || !isFirebaseConfigured) {
      setIsSavingKeyword(false);
      return;
    }

    try {
      const docRef = doc(
        db,
        "users",
        user.uid,
        "settings",
        "forbiddenKeywords",
      );
      const docSnap = await getDoc(docRef);

      let currentKeywords: string[] = [];
      if (docSnap.exists()) {
        currentKeywords = docSnap.data().keywords || [];
      }

      if (
        !currentKeywords.some(
          (k) => k.toLowerCase() === selectedIngredient.toLowerCase(),
        )
      ) {
        await setDoc(docRef, {
          keywords: [...currentKeywords, selectedIngredient],
          updatedAt: new Date().toISOString(),
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Sync keywords back to AuthContext so future scans pick them up
      refreshUserProfile();
    } catch (error) {
      console.error("Error saving keyword:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSavingKeyword(false);
      setShowAddKeywordModal(false);
      setSelectedIngredient(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["4xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <StatusBadge status={overallStatus} />

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <ThemedText
              style={[styles.summaryNumber, { color: AppColors.success }]}
            >
              {safeCount}
            </ThemedText>
            <ThemedText
              style={[styles.summaryLabel, { color: AppColors.secondaryText }]}
            >
              Safe
            </ThemedText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText
              style={[styles.summaryNumber, { color: AppColors.warning }]}
            >
              {cautionCount}
            </ThemedText>
            <ThemedText
              style={[styles.summaryLabel, { color: AppColors.secondaryText }]}
            >
              Caution
            </ThemedText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText
              style={[styles.summaryNumber, { color: AppColors.destructive }]}
            >
              {unsafeCount}
            </ThemedText>
            <ThemedText
              style={[styles.summaryLabel, { color: AppColors.secondaryText }]}
            >
              Unsafe
            </ThemedText>
          </View>
        </View>

        {analysisResult.ingredients.length > 0 ? (
          <>
            <IngredientHighlighter
              rawText={analysisResult.ingredients.join(", ")}
              matchedIngredients={matchedIngredients}
            />
            <View style={styles.ingredientsSection}>
              <ThemedText style={styles.sectionTitle}>
                Detected Ingredients
              </ThemedText>
              <ThemedText
                style={[
                  styles.sectionSubtitle,
                  { color: AppColors.secondaryText },
                ]}
              >
                Tap a flagged ingredient to add it to your forbidden keywords
              </ThemedText>
              <View style={styles.ingredientsContainer}>
                {analysisResult.ingredients.map((ingredient, index) => {
                  const isMatched = matchedNames.has(ingredient.toLowerCase());
                  const matchInfo = matchedIngredients.find(
                    (m) => m.name.toLowerCase() === ingredient.toLowerCase(),
                  );
                  const isAllergen = matchInfo?.type === "allergen";
                  const isKeyword = matchInfo?.type === "keyword";

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.ingredientChip,
                        isMatched && {
                          backgroundColor: isAllergen
                            ? AppColors.destructive + "30"
                            : isKeyword
                              ? AppColors.destructive + "20"
                              : AppColors.warning + "20",
                          borderWidth: 1,
                          borderColor:
                            isAllergen || isKeyword
                              ? AppColors.destructive
                              : AppColors.warning,
                        },
                      ]}
                      onPress={() =>
                        isMatched && handleAddToKeywords(ingredient)
                      }
                      disabled={!isMatched}
                      activeOpacity={isMatched ? 0.7 : 1}
                    >
                      {isMatched ? (
                        <Ionicons
                          name={
                            isAllergen || isKeyword ? "alert-circle" : "warning"
                          }
                          size={14}
                          color={
                            isAllergen || isKeyword
                              ? AppColors.destructive
                              : AppColors.warning
                          }
                        />
                      ) : null}
                      <ThemedText
                        style={[
                          styles.ingredientText,
                          isMatched && {
                            color:
                              isAllergen || isKeyword
                                ? AppColors.destructive
                                : AppColors.warning,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {ingredient}
                      </ThemedText>
                      {isMatched ? (
                        <Feather
                          name="plus-circle"
                          size={14}
                          color={AppColors.primary}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        <ThemedText style={styles.sectionTitle}>Profile Results</ThemedText>
        <View style={styles.resultsContainer}>
          {analysisResult.results.map((result) => (
            <ResultCard key={result.profileId} result={result} />
          ))}
        </View>

        <View style={styles.disclaimerContainer}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={AppColors.secondaryText}
          />
          <ThemedText style={styles.disclaimerText}>
            Always verify ingredients manually. This is not medical advice.
          </ThemedText>
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <Button onPress={handleScanAgain} style={styles.scanAgainButton}>
          <Ionicons name="camera-outline" size={20} color={AppColors.text} />
          <ThemedText style={styles.buttonText}>Scan Again</ThemedText>
        </Button>
        <Button onPress={handleDone} style={styles.doneButton}>
          <ThemedText style={styles.buttonText}>Done</ThemedText>
        </Button>
      </View>

      <Modal
        visible={showAddKeywordModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAddKeywordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: AppColors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Add Forbidden Keyword
              </ThemedText>
              <TouchableOpacity onPress={() => setShowAddKeywordModal(false)}>
                <Feather name="x" size={24} color={AppColors.text} />
              </TouchableOpacity>
            </View>

            <ThemedText
              style={[
                styles.modalDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Add &quot;{selectedIngredient}&quot; to your forbidden keywords?
              This ingredient will be flagged in all future scans.
            </ThemedText>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: AppColors.surface },
                ]}
                onPress={() => setShowAddKeywordModal(false)}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: AppColors.primaryDark },
                  isSavingKeyword && { opacity: 0.6 },
                ]}
                onPress={confirmAddKeyword}
                disabled={isSavingKeyword}
              >
                {isSavingKeyword ? (
                  <ActivityIndicator size="small" color={AppColors.text} />
                ) : (
                  <ThemedText
                    style={[styles.modalButtonText, { color: "#fff" }]}
                  >
                    Add Keyword
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <UnsafeIssuesModal
        visible={showUnsafeModal}
        onClose={() => setShowUnsafeModal(false)}
        results={analysisResult.results}
        fullIngredients={analysisResult.ingredients}
        isFamilyChecked={analysisResult.results.length > 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  statusLabel: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 2,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  summaryItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: AppColors.divider,
  },
  ingredientsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  ingredientsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  ingredientChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  ingredientText: {
    fontSize: 13,
    color: AppColors.secondaryText,
  },
  resultsContainer: {
    gap: Spacing.md,
  },
  resultCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: "hidden",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  resultInfo: {
    marginLeft: Spacing.md,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  resultBody: {
    marginTop: Spacing.sm,
  },
  safeMessage: {
    fontSize: 14,
    color: AppColors.secondaryText,
    lineHeight: 20,
  },
  issuesList: {
    gap: Spacing.md,
  },
  issueSection: {
    gap: Spacing.sm,
  },
  issueSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  reasonsList: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  reasonText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.divider,
    backgroundColor: AppColors.background,
  },
  scanAgainButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.surface,
    gap: Spacing.sm,
  },
  doneButton: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  disclaimerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
  },
  disclaimerText: {
    fontSize: 12,
    color: AppColors.secondaryText,
    textAlign: "center",
    flex: 1,
  },
});
