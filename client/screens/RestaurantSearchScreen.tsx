import React, { useState, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  distance: string;
  allergenFriendly: string[];
  address: string;
  priceLevel: string;
}

const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: "1",
    name: "Green Garden Bistro",
    cuisine: "Vegetarian",
    rating: 4.7,
    distance: "0.3 mi",
    allergenFriendly: ["Gluten-Free", "Dairy-Free", "Nut-Free"],
    address: "123 Main St",
    priceLevel: "$$",
  },
  {
    id: "2",
    name: "The Allergy-Free Kitchen",
    cuisine: "American",
    rating: 4.9,
    distance: "0.8 mi",
    allergenFriendly: ["Gluten-Free", "Dairy-Free", "Nut-Free", "Soy-Free"],
    address: "456 Oak Ave",
    priceLevel: "$$$",
  },
  {
    id: "3",
    name: "Pure Plates",
    cuisine: "Mediterranean",
    rating: 4.5,
    distance: "1.2 mi",
    allergenFriendly: ["Gluten-Free", "Vegan Options"],
    address: "789 Elm Blvd",
    priceLevel: "$$",
  },
  {
    id: "4",
    name: "Safe Bites Cafe",
    cuisine: "Cafe",
    rating: 4.6,
    distance: "0.5 mi",
    allergenFriendly: ["Nut-Free", "Dairy-Free"],
    address: "321 Pine St",
    priceLevel: "$",
  },
  {
    id: "5",
    name: "Wholesome Kitchen",
    cuisine: "Farm-to-Table",
    rating: 4.8,
    distance: "1.5 mi",
    allergenFriendly: ["Gluten-Free", "Organic", "Vegan Options"],
    address: "555 Maple Dr",
    priceLevel: "$$$",
  },
  {
    id: "6",
    name: "Celiac's Delight",
    cuisine: "Italian",
    rating: 4.4,
    distance: "2.0 mi",
    allergenFriendly: ["100% Gluten-Free"],
    address: "888 Cedar Ln",
    priceLevel: "$$",
  },
];

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress: () => void;
}

function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: AppColors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <ThemedText style={styles.restaurantName}>
            {restaurant.name}
          </ThemedText>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color={AppColors.warning} />
            <ThemedText style={styles.rating}>{restaurant.rating}</ThemedText>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <ThemedText
            style={[styles.cuisine, { color: AppColors.secondaryText }]}
          >
            {restaurant.cuisine}
          </ThemedText>
          <ThemedText
            style={[styles.distance, { color: AppColors.secondaryText }]}
          >
            {restaurant.distance}
          </ThemedText>
          <ThemedText
            style={[styles.priceLevel, { color: AppColors.secondaryText }]}
          >
            {restaurant.priceLevel}
          </ThemedText>
        </View>
      </View>

      <View style={styles.tagsContainer}>
        {restaurant.allergenFriendly.map((tag, index) => (
          <View
            key={index}
            style={[styles.tag, { backgroundColor: AppColors.primary + "20" }]}
          >
            <Ionicons
              name="checkmark-circle"
              size={12}
              color={AppColors.primary}
            />
            <ThemedText style={[styles.tagText, { color: AppColors.primary }]}>
              {tag}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.addressRow}>
        <Ionicons
          name="location-outline"
          size={14}
          color={AppColors.secondaryText}
        />
        <ThemedText
          style={[styles.address, { color: AppColors.secondaryText }]}
        >
          {restaurant.address}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

export default function RestaurantSearchScreen() {
  useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_RESTAURANTS;

    const query = searchQuery.toLowerCase();
    return MOCK_RESTAURANTS.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.cuisine.toLowerCase().includes(query) ||
        r.allergenFriendly.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [searchQuery]);

  const handleRestaurantPress = (restaurant: Restaurant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <View
        style={[
          styles.searchContainer,
          { paddingTop: headerHeight + Spacing.md },
        ]}
      >
        <View
          style={[styles.searchBar, { backgroundColor: AppColors.surface }]}
        >
          <Ionicons name="search" size={20} color={AppColors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: AppColors.text }]}
            placeholder="Search restaurants, cuisines, or allergens..."
            placeholderTextColor={AppColors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={AppColors.secondaryText}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing["3xl"],
        }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText
          style={[styles.resultsCount, { color: AppColors.secondaryText }]}
        >
          {filteredRestaurants.length} allergen-friendly restaurants nearby
        </ThemedText>

        <View style={styles.restaurantsList}>
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onPress={() => handleRestaurantPress(restaurant)}
            />
          ))}
        </View>

        {filteredRestaurants.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="restaurant-outline"
              size={48}
              color={AppColors.secondaryText}
            />
            <ThemedText
              style={[styles.emptyText, { color: AppColors.secondaryText }]}
            >
              No restaurants found matching your search
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  resultsCount: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  restaurantsList: {
    gap: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    marginBottom: Spacing.sm,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  restaurantName: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    marginRight: Spacing.sm,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: "500",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: 4,
  },
  cuisine: {
    fontSize: 14,
  },
  distance: {
    fontSize: 14,
  },
  priceLevel: {
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  address: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  emptyText: {
    fontSize: 16,
    marginTop: Spacing.lg,
    textAlign: "center",
  },
});
