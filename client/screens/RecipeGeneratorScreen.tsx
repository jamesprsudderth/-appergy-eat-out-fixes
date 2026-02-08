import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured } from "@/services/firebase";
import { getApiUrl } from "@/lib/query-client";

interface ProfileInfo {
  id: string;
  name: string;
  allergies: string[];
  preferences: string[];
  forbiddenKeywords?: string[];
}

interface Ingredient {
  item: string;
  amount: string;
}

interface Recipe {
  id?: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: number;
  difficulty: string;
  cuisine: string;
  generatedFor: string[];
  allergenNotes?: string;
  substitutionTips?: string[];
  createdAt?: Date;
  isFavorite?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Try: healthy breakfast ideas",
  "Try: quick weeknight dinner",
  "Try: mediterranean lunch for 4",
  "Try: kid-friendly snacks",
  "Try: Italian pasta dinner",
];

const QUICK_SUGGESTIONS = [
  "Quick weeknight dinner",
  "Healthy breakfast",
  "Kid-friendly lunch",
  "Dessert",
  "Meal prep ideas",
];

export default function RecipeGeneratorScreen() {
  useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();

  const [preference, setPreference] = useState("");
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfiles();
    loadSavedRecipes();
  }, [user]);

  const loadProfiles = async () => {
    const loadedProfiles: ProfileInfo[] = [];
    let forbiddenKeywords: string[] = [];

    const userName = user?.displayName || user?.email?.split("@")[0] || "You";

    if (user && isFirebaseConfigured && db) {
      try {
        // Load forbidden keywords first
        const keywordsRef = doc(
          db,
          "users",
          user.uid,
          "settings",
          "forbiddenKeywords",
        );
        const keywordsSnap = await getDoc(keywordsRef);
        if (keywordsSnap.exists()) {
          forbiddenKeywords = keywordsSnap.data().keywords || [];
        }

        // Load main profile from Firestore
        const mainProfileRef = doc(db, "users", user.uid);
        const mainProfileSnap = await getDoc(mainProfileRef);
        if (mainProfileSnap.exists()) {
          const userData = mainProfileSnap.data();
          const profileData = userData.mainProfile || {};

          // Extract allergies from structured format
          const allergiesData = profileData.allergies || {};
          const commonAllergies = allergiesData.common || [];
          const customAllergies = allergiesData.custom || [];
          const allAllergies = [...commonAllergies, ...customAllergies];

          // Extract preferences from structured format
          const preferencesData = profileData.preferences || {};
          const commonPreferences = preferencesData.common || [];
          const customPreferences = preferencesData.custom || [];
          const allPreferences = [...commonPreferences, ...customPreferences];

          loadedProfiles.push({
            id: "mainProfile",
            name: profileData.name || userName,
            allergies: allAllergies,
            preferences: allPreferences,
            forbiddenKeywords,
          });
        } else {
          loadedProfiles.push({
            id: "mainProfile",
            name: userName,
            allergies: [],
            preferences: [],
            forbiddenKeywords,
          });
        }

        // Load family member profiles
        for (let i = 1; i <= 4; i++) {
          const memberRef = doc(
            db,
            "users",
            user.uid,
            "familyProfiles",
            `member${i}`,
          );
          const memberSnap = await getDoc(memberRef);
          if (memberSnap.exists()) {
            const data = memberSnap.data();

            // Extract allergies from structured format for family members
            const memberAllergies = data.allergies || {};
            const memberCommonAllergies = Array.isArray(memberAllergies)
              ? memberAllergies
              : [
                  ...(memberAllergies.common || []),
                  ...(memberAllergies.custom || []),
                ];

            // Extract preferences from structured format for family members
            const memberPreferences = data.preferences || {};
            const memberCommonPreferences = Array.isArray(memberPreferences)
              ? memberPreferences
              : [
                  ...(memberPreferences.common || []),
                  ...(memberPreferences.custom || []),
                ];

            loadedProfiles.push({
              id: `member${i}`,
              name: data.name || `Family Member ${i}`,
              allergies: memberCommonAllergies,
              preferences: memberCommonPreferences,
              forbiddenKeywords,
            });
          }
        }
      } catch (error) {
        console.error("Error loading profiles:", error);
        // Fallback with demo data
        loadedProfiles.push({
          id: "mainProfile",
          name: userName,
          allergies: ["Dairy", "Peanuts"],
          preferences: ["Vegetarian"],
          forbiddenKeywords: ["MSG"],
        });
      }
    } else {
      // Demo mode
      loadedProfiles.push({
        id: "mainProfile",
        name: userName,
        allergies: ["Dairy", "Peanuts"],
        preferences: ["Vegetarian"],
        forbiddenKeywords: ["MSG", "Artificial colors"],
      });
    }

    // Ensure we always have at least one profile
    if (loadedProfiles.length === 0) {
      loadedProfiles.push({
        id: "mainProfile",
        name: userName,
        allergies: [],
        preferences: [],
        forbiddenKeywords: [],
      });
    }

    setProfiles(loadedProfiles);
    setSelectedProfileIds([loadedProfiles[0].id]);

    console.log(
      "Recipe Generator: Loaded profiles:",
      loadedProfiles.map((p) => ({
        name: p.name,
        allergies: p.allergies.length,
        preferences: p.preferences.length,
      })),
    );
  };

  const loadSavedRecipes = async () => {
    if (!user || !isFirebaseConfigured || !db) return;

    try {
      const recipesRef = collection(db, "users", user.uid, "savedRecipes");
      const q = query(recipesRef, orderBy("savedAt", "desc"));
      const snapshot = await getDocs(q);
      const recipes: Recipe[] = [];
      snapshot.forEach((doc) => {
        recipes.push({ id: doc.id, ...doc.data() } as Recipe);
      });
      setSavedRecipes(recipes);
    } catch (error) {
      console.error("Error loading saved recipes:", error);
    }
  };

  const toggleProfile = (profileId: string) => {
    Haptics.selectionAsync();
    setSelectedProfileIds((prev) => {
      if (prev.includes(profileId)) {
        if (prev.length > 1) {
          return prev.filter((id) => id !== profileId);
        }
        return prev;
      }
      return [...prev, profileId];
    });
  };

  const getSelectedAllergies = () => {
    const selected = profiles.filter((p) => selectedProfileIds.includes(p.id));
    const allergies = new Set<string>();
    selected.forEach((p) => {
      p.allergies.forEach((a) => allergies.add(a));
      (p.forbiddenKeywords || []).forEach((k) => allergies.add(k));
    });
    return Array.from(allergies);
  };

  const getSelectedPreferences = () => {
    const selected = profiles.filter((p) => selectedProfileIds.includes(p.id));
    const prefs = new Set<string>();
    selected.forEach((p) => {
      p.preferences.forEach((pref) => prefs.add(pref));
    });
    return Array.from(prefs);
  };

  const handleGenerate = async () => {
    if (!preference.trim()) {
      Alert.alert(
        "Enter a preference",
        "Please describe what kind of recipe you'd like.",
      );
      return;
    }

    setIsLoading(true);
    setRecipe(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(
        new URL("/api/generate-recipe", apiUrl).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preference: preference.trim(),
            allergies: getSelectedAllergies(),
            dietaryPreferences: getSelectedPreferences(),
            profileNames: profiles
              .filter((p) => selectedProfileIds.includes(p.id))
              .map((p) => p.name),
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate recipe");
      }

      const data = await response.json();
      setRecipe(data.recipe);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Recipe generation error:", error);
      Alert.alert("Error", "Failed to generate recipe. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!recipe || !user || !isFirebaseConfigured || !db) return;

    setIsSaving(true);
    try {
      const recipesRef = collection(db, "users", user.uid, "savedRecipes");
      await addDoc(recipesRef, {
        ...recipe,
        createdAt: new Date(),
        isFavorite: true,
      });
      await loadSavedRecipes();
      Alert.alert("Saved", "Recipe saved to your favorites!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error saving recipe:", error);
      Alert.alert("Error", "Failed to save recipe.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (recipeId: string) => {
    if (!user || !isFirebaseConfigured || !db) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "savedRecipes", recipeId));
      await loadSavedRecipes();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error deleting recipe:", error);
    }
  };

  const handleShare = async (recipeToShare?: Recipe) => {
    const r = recipeToShare || recipe;
    if (!r) return;

    const recipeText = `${r.title}
${r.description}

Cuisine: ${r.cuisine} | Difficulty: ${r.difficulty}
Prep Time: ${r.prepTime}
Cook Time: ${r.cookTime}
Servings: ${r.servings}

INGREDIENTS:
${r.ingredients.map((i) => `- ${i.amount} ${i.item}`).join("\n")}

INSTRUCTIONS:
${r.instructions.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}

Generated by Appergy`;

    try {
      await Share.share({ message: recipeText });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="book-outline" size={64} color={AppColors.secondaryText} />
      <ThemedText style={styles.emptyTitle}>Generate a Recipe</ThemedText>
      <ThemedText
        style={[styles.emptyText, { color: AppColors.secondaryText }]}
      >
        Enter what you&apos;re craving and we&apos;ll create a safe recipe for
        you
      </ThemedText>
      <View style={styles.examples}>
        {EXAMPLE_PROMPTS.map((prompt, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.exampleChip,
              { backgroundColor: AppColors.surfaceSecondary },
            ]}
            onPress={() => setPreference(prompt.replace("Try: ", ""))}
          >
            <ThemedText
              style={[styles.exampleText, { color: AppColors.primary }]}
            >
              {prompt}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderRecipe = (r: Recipe, isSaved: boolean = false) => (
    <View style={[styles.recipeCard, { backgroundColor: AppColors.surface }]}>
      <View style={styles.recipeHeader}>
        <ThemedText style={styles.recipeTitle}>{r.title}</ThemedText>
        <View style={styles.recipeActions}>
          {!isSaved && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={styles.actionButton}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <Ionicons
                  name="heart-outline"
                  size={24}
                  color={AppColors.primary}
                />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleShare(r)}
            style={styles.actionButton}
          >
            <Ionicons
              name="share-outline"
              size={24}
              color={AppColors.primary}
            />
          </TouchableOpacity>
          {isSaved && r.id && (
            <TouchableOpacity
              onPress={() => handleDelete(r.id!)}
              style={styles.actionButton}
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color={AppColors.destructive}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeItem}>
          <Ionicons
            name="timer-outline"
            size={16}
            color={AppColors.secondaryText}
          />
          <ThemedText
            style={[styles.timeText, { color: AppColors.secondaryText }]}
          >
            Prep: {r.prepTime}
          </ThemedText>
        </View>
        <View style={styles.timeItem}>
          <Ionicons
            name="flame-outline"
            size={16}
            color={AppColors.secondaryText}
          />
          <ThemedText
            style={[styles.timeText, { color: AppColors.secondaryText }]}
          >
            Cook: {r.cookTime}
          </ThemedText>
        </View>
        <View style={styles.timeItem}>
          <Ionicons
            name="people-outline"
            size={16}
            color={AppColors.secondaryText}
          />
          <ThemedText
            style={[styles.timeText, { color: AppColors.secondaryText }]}
          >
            Serves: {r.servings}
          </ThemedText>
        </View>
      </View>

      {r.description ? (
        <ThemedText
          style={[styles.descriptionText, { color: AppColors.secondaryText }]}
        >
          {r.description}
        </ThemedText>
      ) : null}

      <View style={styles.metaRow}>
        {r.cuisine ? (
          <View
            style={[
              styles.metaChip,
              { backgroundColor: AppColors.primary + "20" },
            ]}
          >
            <ThemedText
              style={[styles.metaChipText, { color: AppColors.primary }]}
            >
              {r.cuisine}
            </ThemedText>
          </View>
        ) : null}
        {r.difficulty ? (
          <View
            style={[
              styles.metaChip,
              { backgroundColor: AppColors.surfaceSecondary },
            ]}
          >
            <ThemedText
              style={[styles.metaChipText, { color: AppColors.text }]}
            >
              {r.difficulty}
            </ThemedText>
          </View>
        ) : null}
        {r.generatedFor && r.generatedFor.length > 0 ? (
          <View
            style={[
              styles.metaChip,
              { backgroundColor: AppColors.success + "20" },
            ]}
          >
            <ThemedText
              style={[styles.metaChipText, { color: AppColors.success }]}
            >
              For: {r.generatedFor.join(", ")}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Ingredients</ThemedText>
        {r.ingredients.map((ingredient, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <View
              style={[
                styles.bullet,
                { backgroundColor: AppColors.primaryDark },
              ]}
            />
            <ThemedText style={styles.ingredientText}>
              {typeof ingredient === "string"
                ? ingredient
                : `${ingredient.amount} ${ingredient.item}`}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Instructions</ThemedText>
        {r.instructions.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            <View
              style={[
                styles.stepNumber,
                { backgroundColor: AppColors.primaryDark },
              ]}
            >
              <ThemedText style={styles.stepNumberText}>{idx + 1}</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>{step}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabButtons}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              !showSaved && { backgroundColor: AppColors.primaryDark },
            ]}
            onPress={() => setShowSaved(false)}
          >
            <ThemedText
              style={[styles.tabButtonText, !showSaved && { color: "#fff" }]}
            >
              Generate
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              showSaved && { backgroundColor: AppColors.primaryDark },
            ]}
            onPress={() => setShowSaved(true)}
          >
            <ThemedText
              style={[styles.tabButtonText, showSaved && { color: "#fff" }]}
            >
              Saved ({savedRecipes.length})
            </ThemedText>
          </TouchableOpacity>
        </View>

        {showSaved ? (
          <View style={styles.savedList}>
            {savedRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="heart-outline"
                  size={48}
                  color={AppColors.secondaryText}
                />
                <ThemedText
                  style={[styles.emptyText, { color: AppColors.secondaryText }]}
                >
                  No saved recipes yet
                </ThemedText>
              </View>
            ) : (
              savedRecipes.map((r) => (
                <View key={r.id}>{renderRecipe(r, true)}</View>
              ))
            )}
          </View>
        ) : (
          <>
            <View
              style={[
                styles.inputSection,
                { backgroundColor: AppColors.surface },
              ]}
            >
              <ThemedText style={styles.label}>
                What would you like to cook?
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: AppColors.surfaceSecondary,
                    color: AppColors.text,
                  },
                ]}
                placeholder="e.g., Italian pasta, quick dinner ideas..."
                placeholderTextColor={AppColors.secondaryText}
                value={preference}
                onChangeText={setPreference}
                multiline
              />
              <View style={styles.quickSuggestions}>
                {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.suggestionChip,
                      { backgroundColor: AppColors.surfaceSecondary },
                    ]}
                    onPress={() => {
                      setPreference(suggestion);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.suggestionText,
                        { color: AppColors.primary },
                      ]}
                    >
                      {suggestion}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {profiles.length > 1 && (
              <View
                style={[
                  styles.profileSection,
                  { backgroundColor: AppColors.surface },
                ]}
              >
                <ThemedText style={styles.label}>Cook for:</ThemedText>
                <View style={styles.profileList}>
                  {profiles.map((profile) => (
                    <TouchableOpacity
                      key={profile.id}
                      style={[
                        styles.profileChip,
                        { borderColor: AppColors.divider },
                        selectedProfileIds.includes(profile.id) && {
                          backgroundColor: AppColors.primaryDark,
                          borderColor: AppColors.primary,
                        },
                      ]}
                      onPress={() => toggleProfile(profile.id)}
                    >
                      <Ionicons
                        name={
                          selectedProfileIds.includes(profile.id)
                            ? "checkbox"
                            : "square-outline"
                        }
                        size={18}
                        color={
                          selectedProfileIds.includes(profile.id)
                            ? "#fff"
                            : AppColors.text
                        }
                      />
                      <ThemedText
                        style={[
                          styles.profileName,
                          selectedProfileIds.includes(profile.id) && {
                            color: "#fff",
                          },
                        ]}
                      >
                        {profile.name}
                      </ThemedText>
                      {profile.allergies.length > 0 && (
                        <View
                          style={[
                            styles.allergyBadge,
                            {
                              backgroundColor: selectedProfileIds.includes(
                                profile.id,
                              )
                                ? "rgba(255,255,255,0.3)"
                                : AppColors.warning + "30",
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.allergyBadgeText,
                              selectedProfileIds.includes(profile.id) && {
                                color: "#fff",
                              },
                            ]}
                          >
                            {profile.allergies.length}
                          </ThemedText>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Button
              onPress={handleGenerate}
              disabled={isLoading || !preference.trim()}
              style={styles.generateButton}
            >
              {isLoading ? "Generating..." : "Generate Recipe"}
            </Button>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={AppColors.primary} />
                <ThemedText
                  style={[
                    styles.loadingText,
                    { color: AppColors.secondaryText },
                  ]}
                >
                  Creating a safe recipe for you...
                </ThemedText>
              </View>
            )}

            {!isLoading && !recipe && renderEmptyState()}

            {recipe && !isLoading && (
              <>
                {renderRecipe(recipe)}
                <TouchableOpacity
                  style={[
                    styles.regenerateButton,
                    { borderColor: AppColors.primary },
                  ]}
                  onPress={handleGenerate}
                  disabled={isLoading}
                >
                  <Ionicons
                    name="refresh"
                    size={18}
                    color={AppColors.primary}
                  />
                  <ThemedText
                    style={[
                      styles.regenerateText,
                      { color: AppColors.primary },
                    ]}
                  >
                    Regenerate Recipe
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
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
  tabButtons: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    backgroundColor: AppColors.surface,
  },
  tabButtonText: {
    fontWeight: "600",
  },
  inputSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  profileSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  profileList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  profileChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  profileName: {
    fontSize: 14,
  },
  allergyBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  allergyBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  generateButton: {
    marginBottom: Spacing.lg,
  },
  quickSuggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  suggestionChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  regenerateText: {
    fontSize: 15,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  examples: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  exampleChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  exampleText: {
    fontSize: 13,
  },
  savedList: {
    gap: Spacing.md,
  },
  recipeCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  recipeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  metaChip: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    marginRight: Spacing.md,
  },
  recipeActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.xs,
  },
  timeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  timeText: {
    fontSize: 13,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: Spacing.sm,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  stepNumberText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
