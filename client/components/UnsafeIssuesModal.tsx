import React, { useState } from "react";
import {
  View,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ProfileResult } from "@/services/ai";

const ISSUE_RED = "#ff5252";
const MODAL_BG = "#1e1e1e";

interface UnsafeIssuesModalProps {
  visible: boolean;
  onClose: () => void;
  results: ProfileResult[];
  fullIngredients: string[];
  isFamilyChecked?: boolean;
}

interface IssueItem {
  person: string;
  type: "allergen" | "keyword" | "preference";
  item: string;
  reason?: string;
}

export function UnsafeIssuesModal({
  visible,
  onClose,
  results,
  fullIngredients,
  isFamilyChecked = false,
}: UnsafeIssuesModalProps) {
  const [showIngredients, setShowIngredients] = useState(false);

  const allIssues: IssueItem[] = [];

  results.forEach((result) => {
    if (result.status === "safe") return;

    result.matchedAllergens.forEach((allergen) => {
      allIssues.push({
        person: result.name,
        type: "allergen",
        item: allergen,
      });
    });

    result.matchedKeywords.forEach((keyword) => {
      allIssues.push({
        person: result.name,
        type: "keyword",
        item: keyword,
      });
    });

    result.matchedPreferences.forEach((pref) => {
      allIssues.push({
        person: result.name,
        type: "preference",
        item: pref,
        reason: `violates ${pref} preference`,
      });
    });
  });

  const allergenIssues = allIssues.filter((i) => i.type === "allergen");
  const keywordIssues = allIssues.filter((i) => i.type === "keyword");
  const preferenceIssues = allIssues.filter((i) => i.type === "preference");

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowIngredients(false);
    onClose();
  };

  const handleViewIngredients = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowIngredients(true);
  };

  const handleBackToIssues = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowIngredients(false);
  };

  if (allIssues.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="warning" size={28} color={ISSUE_RED} />
            </View>
            <ThemedText style={styles.title}>
              {showIngredients
                ? "Full Ingredients List"
                : isFamilyChecked
                  ? "Family Safety Alert"
                  : "Potential Issues Detected"}
            </ThemedText>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={AppColors.text} />
            </TouchableOpacity>
          </View>

          {showIngredients ? (
            <>
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.ingredientsContent}
                showsVerticalScrollIndicator={true}
              >
                <ThemedText style={styles.ingredientsText}>
                  {fullIngredients.length > 0
                    ? fullIngredients.join(", ")
                    : "No ingredients detected"}
                </ThemedText>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleBackToIssues}
                >
                  <Ionicons
                    name="arrow-back"
                    size={18}
                    color={AppColors.text}
                  />
                  <ThemedText style={styles.buttonText}>
                    Back to Issues
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <ThemedText style={styles.subtitle}>
                This item may not be safe for you or your family members.
              </ThemedText>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
              >
                {allergenIssues.length > 0 ? (
                  <View style={styles.issueSection}>
                    <View style={styles.sectionHeader}>
                      <Ionicons
                        name="alert-circle"
                        size={18}
                        color={ISSUE_RED}
                      />
                      <ThemedText style={styles.sectionTitle}>
                        Allergens Detected
                      </ThemedText>
                    </View>
                    {allergenIssues.map((issue, index) => (
                      <View key={`allergen-${index}`} style={styles.issueRow}>
                        <View style={styles.bullet} />
                        <ThemedText style={styles.issueText}>
                          Contains{" "}
                          <ThemedText style={styles.issueHighlight}>
                            {issue.item}
                          </ThemedText>{" "}
                          (allergen for {issue.person})
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}

                {keywordIssues.length > 0 ? (
                  <View style={styles.issueSection}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="ban" size={18} color={ISSUE_RED} />
                      <ThemedText style={styles.sectionTitle}>
                        Forbidden Keywords
                      </ThemedText>
                    </View>
                    {keywordIssues.map((issue, index) => (
                      <View key={`keyword-${index}`} style={styles.issueRow}>
                        <View style={styles.bullet} />
                        <ThemedText style={styles.issueText}>
                          Contains{" "}
                          <ThemedText style={styles.issueHighlight}>
                            {issue.item}
                          </ThemedText>{" "}
                          (forbidden for {issue.person})
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}

                {preferenceIssues.length > 0 ? (
                  <View style={styles.issueSection}>
                    <View style={styles.sectionHeader}>
                      <Ionicons
                        name="nutrition"
                        size={18}
                        color={AppColors.warning}
                      />
                      <ThemedText
                        style={[
                          styles.sectionTitle,
                          { color: AppColors.warning },
                        ]}
                      >
                        Preference Violations
                      </ThemedText>
                    </View>
                    {preferenceIssues.map((issue, index) => (
                      <View key={`pref-${index}`} style={styles.issueRow}>
                        <View
                          style={[
                            styles.bullet,
                            { backgroundColor: AppColors.warning },
                          ]}
                        />
                        <ThemedText style={styles.issueText}>
                          Contains{" "}
                          <ThemedText
                            style={[
                              styles.issueHighlight,
                              { color: AppColors.warning },
                            ]}
                          >
                            {issue.item}
                          </ThemedText>{" "}
                          (
                          {issue.reason ||
                            `conflicts with ${issue.person}'s diet`}
                          )
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleViewIngredients}
                >
                  <Feather name="list" size={18} color="#fff" />
                  <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                    View Full Ingredients
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleClose}
                >
                  <ThemedText style={styles.buttonText}>Close</ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: MODAL_BG,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ISSUE_RED + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.secondaryText,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  ingredientsContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  ingredientsText: {
    fontSize: 15,
    color: AppColors.text,
    lineHeight: 24,
  },
  issueSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: ISSUE_RED,
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ISSUE_RED,
    marginTop: 7,
  },
  issueText: {
    flex: 1,
    fontSize: 14,
    color: AppColors.text,
    lineHeight: 20,
  },
  issueHighlight: {
    color: ISSUE_RED,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "column",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.divider,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: AppColors.primaryDark,
  },
  secondaryButton: {
    backgroundColor: AppColors.surface,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.text,
  },
});
