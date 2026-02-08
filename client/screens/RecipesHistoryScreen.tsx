import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  collection,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured } from "@/services/firebase";

interface IngredientObject {
  item: string;
  amount: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: (string | IngredientObject)[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: number;
  difficulty: string;
  cuisine: string;
  generatedFor: string[];
  allergenNotes?: string;
  substitutionTips?: string[];
  createdAt?: any;
  isFavorite?: boolean;
}

type FilterType = "all" | "favorites" | string;

export default function RecipesHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadRecipes();
  }, [user]);

  useEffect(() => {
    filterRecipes();
  }, [recipes, searchQuery, activeFilter]);

  const loadRecipes = async () => {
    if (!user || !isFirebaseConfigured || !db) {
      setIsLoading(false);
      return;
    }

    try {
      const recipesRef = collection(db, "users", user.uid, "savedRecipes");
      const q = query(recipesRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const loadedRecipes: Recipe[] = [];
      snapshot.forEach((docSnap) => {
        loadedRecipes.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as Recipe);
      });

      setRecipes(loadedRecipes);
    } catch (error) {
      console.error("Error loading recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterRecipes = () => {
    let result = [...recipes];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.ingredients.some((i) =>
            typeof i === "string"
              ? i.toLowerCase().includes(query)
              : i.item.toLowerCase().includes(query),
          ),
      );
    }

    if (activeFilter === "favorites") {
      result = result.filter((r) => r.isFavorite);
    } else if (activeFilter !== "all") {
      result = result.filter(
        (r) =>
          r.cuisine && r.cuisine.toLowerCase() === activeFilter.toLowerCase(),
      );
    }

    setFilteredRecipes(result);
  };

  const handleDelete = async (recipeId: string) => {
    if (!user || !isFirebaseConfigured || !db) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "savedRecipes", recipeId));
      setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error deleting recipe:", error);
      Alert.alert("Error", "Failed to delete recipe");
    }
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    if (!user || !isFirebaseConfigured || !db) return;

    try {
      const recipeRef = doc(db, "users", user.uid, "savedRecipes", recipe.id);
      await updateDoc(recipeRef, { isFavorite: !recipe.isFavorite });
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipe.id ? { ...r, isFavorite: !r.isFavorite } : r,
        ),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const handleShare = async (recipe: Recipe) => {
    const recipeText = `${recipe.title}
${recipe.description || ""}

Cuisine: ${recipe.cuisine} | Difficulty: ${recipe.difficulty}
Prep Time: ${recipe.prepTime}
Cook Time: ${recipe.cookTime}
Servings: ${recipe.servings}

INGREDIENTS:
${recipe.ingredients
  .map((i) => (typeof i === "string" ? `- ${i}` : `- ${i.amount} ${i.item}`))
  .join("\n")}

INSTRUCTIONS:
${recipe.instructions.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}

Generated by Appergy`;

    try {
      await Share.share({ message: recipeText });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const openRecipeModal = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const RecipeCard = ({ recipe }: { recipe: Recipe }) => {
    const translateX = useSharedValue(0);
    const DELETE_THRESHOLD = -80;

    const confirmDelete = useCallback(() => {
      Alert.alert(
        "Delete Recipe",
        `Are you sure you want to delete "${recipe.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => handleDelete(recipe.id),
          },
        ],
      );
    }, [recipe]);

    const panGesture = Gesture.Pan()
      .onUpdate((event) => {
        if (event.translationX < 0) {
          translateX.value = Math.max(event.translationX, -120);
        }
      })
      .onEnd((event) => {
        if (translateX.value < DELETE_THRESHOLD) {
          runOnJS(confirmDelete)();
        }
        translateX.value = withSpring(0);
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    return (
      <View style={styles.cardContainer}>
        <View style={styles.deleteBackground}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
          <ThemedText style={styles.deleteText}>Delete</ThemedText>
        </View>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <TouchableOpacity
              style={[
                styles.recipeCard,
                { backgroundColor: AppColors.surface },
              ]}
              onPress={() => openRecipeModal(recipe)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <ThemedText style={styles.cardTitle} numberOfLines={1}>
                    {recipe.title}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => handleToggleFavorite(recipe)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={recipe.isFavorite ? "star" : "star-outline"}
                      size={22}
                      color={
                        recipe.isFavorite
                          ? AppColors.warning
                          : AppColors.secondaryText
                      }
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardMeta}>
                  {recipe.cuisine ? (
                    <View
                      style={[
                        styles.metaChip,
                        { backgroundColor: AppColors.primary + "20" },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.metaChipText,
                          { color: AppColors.primary },
                        ]}
                      >
                        {recipe.cuisine}
                      </ThemedText>
                    </View>
                  ) : null}
                  {recipe.difficulty ? (
                    <View
                      style={[
                        styles.metaChip,
                        { backgroundColor: AppColors.surfaceSecondary },
                      ]}
                    >
                      <ThemedText
                        style={[styles.metaChipText, { color: AppColors.text }]}
                      >
                        {recipe.difficulty}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.timeInfo}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={AppColors.secondaryText}
                  />
                  <ThemedText
                    style={[
                      styles.timeText,
                      { color: AppColors.secondaryText },
                    ]}
                  >
                    {recipe.prepTime} prep
                  </ThemedText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={AppColors.secondaryText}
                />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  };

  const renderFilterChip = (label: string, value: FilterType) => (
    <TouchableOpacity
      key={value}
      style={[
        styles.filterChip,
        {
          backgroundColor:
            activeFilter === value
              ? AppColors.primary
              : AppColors.surfaceSecondary,
        },
      ]}
      onPress={() => {
        setActiveFilter(value);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <ThemedText
        style={[
          styles.filterChipText,
          { color: activeFilter === value ? "#fff" : AppColors.text },
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  const renderRecipeModal = () => {
    if (!selectedRecipe) return null;
    const r = selectedRecipe;

    return (
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: AppColors.background },
          ]}
        >
          <View style={[styles.modalHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={AppColors.text} />
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => handleToggleFavorite(r)}
                style={styles.modalActionButton}
              >
                <Ionicons
                  name={r.isFavorite ? "star" : "star-outline"}
                  size={24}
                  color={r.isFavorite ? AppColors.warning : AppColors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleShare(r)}
                style={styles.modalActionButton}
              >
                <Ionicons
                  name="share-outline"
                  size={24}
                  color={AppColors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <ThemedText style={styles.modalTitle}>{r.title}</ThemedText>

            {r.description ? (
              <ThemedText
                style={[
                  styles.modalDescription,
                  { color: AppColors.secondaryText },
                ]}
              >
                {r.description}
              </ThemedText>
            ) : null}

            <View style={styles.modalMetaRow}>
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
            </View>

            <View style={styles.modalTimeRow}>
              <View style={styles.modalTimeItem}>
                <Ionicons
                  name="timer-outline"
                  size={18}
                  color={AppColors.secondaryText}
                />
                <ThemedText style={styles.modalTimeLabel}>Prep</ThemedText>
                <ThemedText style={styles.modalTimeValue}>
                  {r.prepTime}
                </ThemedText>
              </View>
              <View style={styles.modalTimeItem}>
                <Ionicons
                  name="flame-outline"
                  size={18}
                  color={AppColors.secondaryText}
                />
                <ThemedText style={styles.modalTimeLabel}>Cook</ThemedText>
                <ThemedText style={styles.modalTimeValue}>
                  {r.cookTime}
                </ThemedText>
              </View>
              <View style={styles.modalTimeItem}>
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={AppColors.secondaryText}
                />
                <ThemedText style={styles.modalTimeLabel}>Serves</ThemedText>
                <ThemedText style={styles.modalTimeValue}>
                  {r.servings}
                </ThemedText>
              </View>
            </View>

            <View style={styles.modalSection}>
              <ThemedText style={styles.modalSectionTitle}>
                Ingredients
              </ThemedText>
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

            <View style={styles.modalSection}>
              <ThemedText style={styles.modalSectionTitle}>
                Instructions
              </ThemedText>
              {r.instructions.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepNumber,
                      { backgroundColor: AppColors.primaryDark },
                    ]}
                  >
                    <ThemedText style={styles.stepNumberText}>
                      {idx + 1}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.stepText}>{step}</ThemedText>
                </View>
              ))}
            </View>

            {r.allergenNotes ? (
              <View
                style={[
                  styles.notesCard,
                  { backgroundColor: AppColors.success + "15" },
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={18}
                  color={AppColors.success}
                />
                <ThemedText
                  style={[styles.notesText, { color: AppColors.success }]}
                >
                  {r.allergenNotes}
                </ThemedText>
              </View>
            ) : null}

            {r.substitutionTips && r.substitutionTips.length > 0 ? (
              <View
                style={[
                  styles.notesCard,
                  { backgroundColor: AppColors.primary + "15" },
                ]}
              >
                <Ionicons
                  name="bulb-outline"
                  size={18}
                  color={AppColors.primary}
                />
                <View style={styles.tipsContainer}>
                  {r.substitutionTips.map((tip, idx) => (
                    <ThemedText
                      key={idx}
                      style={[styles.tipText, { color: AppColors.primary }]}
                    >
                      {tip}
                    </ThemedText>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ height: insets.bottom + Spacing.xl }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const availableCuisines = [
    ...new Set(recipes.map((r) => r.cuisine).filter(Boolean)),
  ];

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.searchContainer}>
          <View
            style={[styles.searchBar, { backgroundColor: AppColors.surface }]}
          >
            <Feather name="search" size={18} color={AppColors.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: AppColors.text }]}
              placeholder="Search recipes..."
              placeholderTextColor={AppColors.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={AppColors.secondaryText}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {renderFilterChip("All", "all")}
          {renderFilterChip("Favorites", "favorites")}
          {availableCuisines.map((cuisine) =>
            renderFilterChip(cuisine, cuisine.toLowerCase()),
          )}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <ThemedText
              style={[styles.loadingText, { color: AppColors.secondaryText }]}
            >
              Loading recipes...
            </ThemedText>
          </View>
        ) : filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="book-outline"
              size={64}
              color={AppColors.secondaryText}
            />
            <ThemedText style={styles.emptyTitle}>
              {searchQuery || activeFilter !== "all"
                ? "No matching recipes"
                : "No saved recipes yet"}
            </ThemedText>
            <ThemedText
              style={[styles.emptyText, { color: AppColors.secondaryText }]}
            >
              {searchQuery || activeFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Generate and save recipes to see them here"}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredRecipes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <RecipeCard recipe={item} />}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + Spacing.xl },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {renderRecipeModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  searchContainer: {
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: Spacing.md,
  },
  filterContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    gap: Spacing.sm,
  },
  cardContainer: {
    position: "relative",
    marginBottom: Spacing.xs,
  },
  deleteBackground: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: AppColors.destructive,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  recipeCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  cardHeader: {
    marginBottom: Spacing.sm,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    marginRight: Spacing.sm,
  },
  cardMeta: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  metaChip: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalActionButton: {
    padding: Spacing.xs,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  modalMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  modalTimeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: AppColors.divider,
  },
  modalTimeItem: {
    alignItems: "center",
    gap: 4,
  },
  modalTimeLabel: {
    fontSize: 12,
    color: AppColors.secondaryText,
  },
  modalTimeValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalSection: {
    marginBottom: Spacing.lg,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
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
    marginTop: 8,
    marginRight: Spacing.sm,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  stepNumberText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  notesCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  tipsContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
