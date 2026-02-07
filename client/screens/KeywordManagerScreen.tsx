import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { db, isFirebaseConfigured } from "@/services/firebase";
import { useAuth } from "@/contexts/AuthContext";

const SUGGESTED_KEYWORDS = [
  "MSG",
  "Aspartame",
  "Carrageenan",
  "Artificial Sweetener",
  "High Fructose Corn Syrup",
  "Sodium Nitrite",
  "Red 40",
  "Yellow 5",
  "BHA",
  "BHT",
  "Maltodextrin",
  "Monosodium Glutamate",
];

export default function KeywordManagerScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, isDemoMode, refreshUserProfile } = useAuth();

  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKeywords();
  }, [user]);

  const loadKeywords = async () => {
    setIsLoading(true);
    setError(null);

    if (isDemoMode) {
      setKeywords(["MSG", "Aspartame", "Artificial Sweetener"]);
      setIsLoading(false);
      return;
    }

    if (!user?.uid || !db || !isFirebaseConfigured) {
      setKeywords([]);
      setIsLoading(false);
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

      if (docSnap.exists()) {
        const data = docSnap.data();
        setKeywords(data.keywords || []);
      } else {
        setKeywords([]);
      }
    } catch (err: any) {
      console.error("Error loading keywords:", err);
      setError("Failed to load keywords");
    } finally {
      setIsLoading(false);
    }
  };

  const saveKeywords = async (updatedKeywords: string[]) => {
    if (isDemoMode) {
      setKeywords(updatedKeywords);
      return;
    }

    if (!user?.uid || !db || !isFirebaseConfigured) return;

    setIsSaving(true);
    try {
      const docRef = doc(
        db,
        "users",
        user.uid,
        "settings",
        "forbiddenKeywords",
      );
      await setDoc(docRef, {
        keywords: updatedKeywords,
        updatedAt: new Date().toISOString(),
      });
      setKeywords(updatedKeywords);
      // Sync keywords back to AuthContext so scanner picks them up
      refreshUserProfile();
    } catch (err: any) {
      console.error("Error saving keywords:", err);
      setError("Failed to save keywords");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddKeyword = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;

    if (keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      setError("This keyword already exists");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    const updatedKeywords = [...keywords, trimmed];
    await saveKeywords(updatedKeywords);
    setNewKeyword("");
  };

  const handleDeleteKeyword = async (keyword: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedKeywords = keywords.filter((k) => k !== keyword);
    await saveKeywords(updatedKeywords);
  };

  const handleAddSuggested = async (keyword: string) => {
    if (keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updatedKeywords = [...keywords, keyword];
    await saveKeywords(updatedKeywords);
  };

  const renderKeywordItem = ({ item }: { item: string }) => (
    <View style={[styles.keywordItem, { backgroundColor: AppColors.surface }]}>
      <View style={styles.keywordContent}>
        <View
          style={[
            styles.keywordIcon,
            { backgroundColor: AppColors.destructive + "20" },
          ]}
        >
          <Ionicons
            name="alert-circle"
            size={18}
            color={AppColors.destructive}
          />
        </View>
        <ThemedText style={styles.keywordText}>{item}</ThemedText>
      </View>
      <TouchableOpacity
        style={[
          styles.deleteButton,
          { backgroundColor: AppColors.destructive + "20" },
        ]}
        onPress={() => handleDeleteKeyword(item)}
        disabled={isSaving}
      >
        <Feather name="trash-2" size={18} color={AppColors.destructive} />
      </TouchableOpacity>
    </View>
  );

  const availableSuggestions = SUGGESTED_KEYWORDS.filter(
    (s) => !keywords.some((k) => k.toLowerCase() === s.toLowerCase()),
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={keywords}
        keyExtractor={(item) => item}
        renderItem={renderKeywordItem}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["4xl"],
          paddingHorizontal: Spacing.lg,
        }}
        ListHeaderComponent={
          <>
            <View style={styles.headerSection}>
              <View
                style={[
                  styles.headerIcon,
                  { backgroundColor: AppColors.destructive + "20" },
                ]}
              >
                <Ionicons name="ban" size={32} color={AppColors.destructive} />
              </View>
              <ThemedText style={styles.title}>Forbidden Keywords</ThemedText>
              <ThemedText
                style={[styles.description, { color: AppColors.secondaryText }]}
              >
                Add ingredients or additives you want to avoid. These will be
                checked in every scan.
              </ThemedText>
            </View>

            <View style={styles.inputSection}>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: AppColors.surface },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: AppColors.text }]}
                  placeholder="Add keyword (e.g., MSG, Aspartame)"
                  placeholderTextColor={AppColors.secondaryText}
                  value={newKeyword}
                  onChangeText={(text) => {
                    setNewKeyword(text);
                    setError(null);
                  }}
                  onSubmitEditing={handleAddKeyword}
                  returnKeyType="done"
                  autoCapitalize="words"
                />
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    { backgroundColor: AppColors.primaryDark },
                    (!newKeyword.trim() || isSaving) && { opacity: 0.5 },
                  ]}
                  onPress={handleAddKeyword}
                  disabled={!newKeyword.trim() || isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={AppColors.text} />
                  ) : (
                    <Feather name="plus" size={20} color={AppColors.text} />
                  )}
                </TouchableOpacity>
              </View>
              {error ? (
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              ) : null}
            </View>

            {availableSuggestions.length > 0 ? (
              <View style={styles.suggestionsSection}>
                <ThemedText style={styles.suggestionsTitle}>
                  Suggestions
                </ThemedText>
                <View style={styles.suggestionsContainer}>
                  {availableSuggestions.slice(0, 6).map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      style={[
                        styles.suggestionChip,
                        { backgroundColor: AppColors.surface },
                      ]}
                      onPress={() => handleAddSuggested(suggestion)}
                      disabled={isSaving}
                    >
                      <ThemedText style={styles.suggestionText}>
                        {suggestion}
                      </ThemedText>
                      <Feather
                        name="plus"
                        size={14}
                        color={AppColors.primary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.listHeader}>
              <ThemedText style={styles.listTitle}>
                Your Keywords ({keywords.length})
              </ThemedText>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="leaf-outline"
              size={40}
              color={AppColors.secondaryText}
            />
            <ThemedText
              style={[styles.emptyText, { color: AppColors.secondaryText }]}
            >
              No forbidden keywords yet. Add some to start tracking.
            </ThemedText>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  inputSection: {
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: AppColors.destructive,
    fontSize: 13,
    marginTop: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  suggestionsSection: {
    marginBottom: Spacing.xl,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    color: AppColors.secondaryText,
  },
  suggestionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  suggestionText: {
    fontSize: 13,
    color: AppColors.secondaryText,
  },
  listHeader: {
    marginBottom: Spacing.md,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  keywordItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  keywordContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  keywordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  keywordText: {
    fontSize: 16,
    flex: 1,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
