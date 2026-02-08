import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeDishSuggestions } from "@/services/dishSuggestions";

const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

interface Restaurant {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now: boolean;
  };
  price_level?: number;
  types?: string[];
}

interface UserProfile {
  allergies: string[];
  preferences: string[];
}

export default function NearbyRestaurantsScreen() {
  useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { user, isDemoMode, userProfile } = useAuth();

  const [locationPermission, setLocationPermission] =
    useState<Location.PermissionStatus | null>(null);
  const [, setLocation] = useState<Location.LocationObject | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (km: number): string => {
    const miles = km * 0.621371;
    if (miles < 0.1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${miles.toFixed(1)} mi`;
  };

  const buildKeywordFromPreferences = (profile: UserProfile): string => {
    const keywordParts: string[] = [];

    const preferenceKeywords: Record<string, string[]> = {
      Vegan: ["vegan", "plant-based"],
      Vegetarian: ["vegetarian", "veggie"],
      "Gluten-Free": ["gluten-free", "celiac"],
      "Dairy-Free": ["dairy-free", "lactose-free"],
      "Nut-Free": ["nut-free", "allergy-friendly"],
      Halal: ["halal"],
      Kosher: ["kosher"],
      Keto: ["keto", "low-carb"],
      Paleo: ["paleo"],
      Organic: ["organic", "natural"],
    };

    for (const pref of profile.preferences) {
      const keywords = preferenceKeywords[pref];
      if (keywords) {
        keywordParts.push(...keywords);
      }
    }

    for (const allergy of profile.allergies) {
      const lowerAllergy = allergy.toLowerCase();
      if (lowerAllergy.includes("gluten")) {
        keywordParts.push("gluten-free");
      } else if (
        lowerAllergy.includes("dairy") ||
        lowerAllergy.includes("milk") ||
        lowerAllergy.includes("lactose")
      ) {
        keywordParts.push("dairy-free");
      } else if (
        lowerAllergy.includes("nut") ||
        lowerAllergy.includes("peanut")
      ) {
        keywordParts.push("nut-free", "allergy-friendly");
      }
    }

    if (keywordParts.length === 0) {
      keywordParts.push("healthy", "allergen-friendly");
    }

    const uniqueKeywords = [...new Set(keywordParts)];
    return uniqueKeywords.slice(0, 5).join("|");
  };

  const rankRestaurantsByPreferences = (
    restaurants: Restaurant[],
    profile: UserProfile,
  ): Restaurant[] => {
    const preferenceTerms = profile.preferences.map((p) => p.toLowerCase());

    return restaurants
      .map((r) => {
        let score = 0;
        const name = r.name.toLowerCase();
        const types = r.types?.map((t) => t.toLowerCase()) || [];

        for (const pref of preferenceTerms) {
          if (name.includes(pref) || types.some((t) => t.includes(pref))) {
            score += 10;
          }
        }

        if (name.includes("vegan") || name.includes("vegetarian")) score += 5;
        if (name.includes("gluten-free") || name.includes("allergy"))
          score += 5;
        if (name.includes("organic") || name.includes("healthy")) score += 3;

        if (r.rating) score += r.rating;

        return { ...r, preferenceScore: score };
      })
      .sort((a: any, b: any) => {
        if (b.preferenceScore !== a.preferenceScore) {
          return b.preferenceScore - a.preferenceScore;
        }
        return (a.distance || 0) - (b.distance || 0);
      });
  };

  const fetchNearbyRestaurants = async (
    latitude: number,
    longitude: number,
  ) => {
    if (!GOOGLE_PLACES_API_KEY) {
      setError("Google Places API key not configured");
      return;
    }

    setIsLoadingRestaurants(true);
    setError(null);

    try {
      const profile = getUserProfile();
      const keyword = buildKeywordFromPreferences(profile);

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=8000&type=restaurant&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_PLACES_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.results) {
        const restaurantsWithDistance = data.results.map((r: Restaurant) => ({
          ...r,
          distance: calculateDistance(
            latitude,
            longitude,
            r.geometry.location.lat,
            r.geometry.location.lng,
          ),
        }));

        const rankedRestaurants = rankRestaurantsByPreferences(
          restaurantsWithDistance,
          profile,
        );
        setRestaurants(rankedRestaurants);
      } else if (data.status === "ZERO_RESULTS") {
        setRestaurants([]);
        setError(
          "No matching restaurants found nearby. Try updating your preferences.",
        );
      } else {
        setError(`API Error: ${data.status}`);
      }
    } catch (err: any) {
      setError(`Failed to fetch restaurants: ${err.message}`);
    } finally {
      setIsLoadingRestaurants(false);
    }
  };

  const handleFindRestaurants = async () => {
    setError(null);
    setIsLoadingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);

      if (status !== "granted") {
        setError("Location permission is required to find nearby restaurants");
        setIsLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(currentLocation);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      await fetchNearbyRestaurants(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
      );
    } catch (err: any) {
      setError(`Failed to get location: ${err.message}`);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const getUserProfile = (): UserProfile => {
    if (isDemoMode) {
      return {
        allergies: ["Peanuts", "Dairy"],
        preferences: ["Vegetarian"],
      };
    }

    if (!userProfile?.mainProfile) {
      return { allergies: [], preferences: [] };
    }

    const mp = userProfile.mainProfile;

    // Handle structured format: { common: [], custom: [], none: bool }
    const allergiesData = mp.allergies || {};
    const allAllergies = Array.isArray(allergiesData)
      ? allergiesData
      : [...(allergiesData.common || []), ...(allergiesData.custom || [])];

    const preferencesData = mp.preferences || {};
    const allPreferences = Array.isArray(preferencesData)
      ? preferencesData
      : [...(preferencesData.common || []), ...(preferencesData.custom || [])];

    return {
      allergies: allAllergies,
      preferences: allPreferences,
    };
  };

  const handleRestaurantPress = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setSuggestions([]);
    setSuggestionsError(null);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleScanMenu = () => {
    setModalVisible(false);
    navigation.navigate("MenuScan", {
      restaurantName: selectedRestaurant?.name || "Restaurant",
    });
  };

  const handleSuggestSafeDishes = async () => {
    if (!selectedRestaurant) return;

    setIsLoadingSuggestions(true);
    setSuggestionsError(null);
    setSuggestions([]);

    try {
      const profile = getUserProfile();

      if (profile.allergies.length === 0 && profile.preferences.length === 0) {
        setSuggestionsError(
          "Please set your allergies and preferences in your profile first",
        );
        setIsLoadingSuggestions(false);
        return;
      }

      const dishSuggestions = await getSafeDishSuggestions(
        selectedRestaurant.name,
        profile.allergies,
        profile.preferences,
      );

      setSuggestions(dishSuggestions);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setSuggestionsError(err.message || "Failed to get suggestions");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const renderRestaurantItem = ({
    item,
  }: {
    item: Restaurant & { distance?: number };
  }) => (
    <TouchableOpacity
      style={[styles.restaurantCard, { backgroundColor: AppColors.surface }]}
      onPress={() => handleRestaurantPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.restaurantInfo}>
        <ThemedText style={styles.restaurantName}>{item.name}</ThemedText>
        <ThemedText
          style={[styles.restaurantAddress, { color: AppColors.secondaryText }]}
        >
          {item.vicinity}
        </ThemedText>
        <View style={styles.restaurantMeta}>
          {item.rating ? (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color={AppColors.warning} />
              <ThemedText style={styles.ratingText}>
                {item.rating.toFixed(1)}
              </ThemedText>
              {item.user_ratings_total ? (
                <ThemedText
                  style={[
                    styles.reviewCount,
                    { color: AppColors.secondaryText },
                  ]}
                >
                  ({item.user_ratings_total})
                </ThemedText>
              ) : null}
            </View>
          ) : null}
          {item.distance !== undefined ? (
            <View style={styles.distanceContainer}>
              <Feather name="map-pin" size={12} color={AppColors.primary} />
              <ThemedText
                style={[styles.distanceText, { color: AppColors.primary }]}
              >
                {formatDistance(item.distance)}
              </ThemedText>
            </View>
          ) : null}
          {item.opening_hours?.open_now !== undefined ? (
            <View
              style={[
                styles.openStatus,
                {
                  backgroundColor: item.opening_hours.open_now
                    ? AppColors.success + "20"
                    : AppColors.destructive + "20",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.openStatusText,
                  {
                    color: item.opening_hours.open_now
                      ? AppColors.success
                      : AppColors.destructive,
                  },
                ]}
              >
                {item.opening_hours.open_now ? "Open" : "Closed"}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={AppColors.secondaryText} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: AppColors.primary + "20" },
        ]}
      >
        <Ionicons name="restaurant" size={48} color={AppColors.primary} />
      </View>
      <ThemedText style={styles.emptyTitle}>
        Find Restaurants Near Me
      </ThemedText>
      <ThemedText
        style={[styles.emptyDescription, { color: AppColors.secondaryText }]}
      >
        Discover allergen-friendly restaurants within 5 miles. Results are
        personalized based on your dietary preferences and allergies.
      </ThemedText>
      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: AppColors.primaryDark },
          isLoadingLocation && { opacity: 0.6 },
        ]}
        onPress={handleFindRestaurants}
        disabled={isLoadingLocation}
        activeOpacity={0.8}
      >
        {isLoadingLocation ? (
          <ActivityIndicator size="small" color={AppColors.buttonText} />
        ) : (
          <Ionicons name="location" size={18} color={AppColors.buttonText} />
        )}
        <ThemedText style={styles.primaryButtonText}>
          {isLoadingLocation
            ? "Getting Location..."
            : "Find Restaurants Near Me"}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderPermissionDenied = () => (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: AppColors.destructive + "20" },
        ]}
      >
        <Feather name="alert-circle" size={48} color={AppColors.destructive} />
      </View>
      <ThemedText style={styles.emptyTitle}>
        Location Permission Required
      </ThemedText>
      <ThemedText
        style={[styles.emptyDescription, { color: AppColors.secondaryText }]}
      >
        Please enable location permission in your device settings to find nearby
        restaurants.
      </ThemedText>
      {Platform.OS !== "web" ? (
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: AppColors.primaryDark },
          ]}
          onPress={() => {
            try {
              Linking.openSettings();
            } catch {
              console.error("Could not open settings");
            }
          }}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.primaryButtonText}>
            Open Settings
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const isLoading = isLoadingLocation || isLoadingRestaurants;

  return (
    <ThemedView style={styles.container}>
      {error && restaurants.length === 0 ? (
        <View style={styles.errorContainer}>
          <Feather
            name="alert-circle"
            size={16}
            color={AppColors.destructive}
          />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}

      {locationPermission === "denied" ? (
        renderPermissionDenied()
      ) : restaurants.length === 0 && !isLoading ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.place_id}
          renderItem={renderRestaurantItem}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.md,
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <ThemedText style={styles.resultsCount}>
                {restaurants.length} restaurants found
              </ThemedText>
              <TouchableOpacity
                style={[
                  styles.refreshButton,
                  { backgroundColor: AppColors.surface },
                ]}
                onPress={handleFindRestaurants}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={AppColors.primary} />
                ) : (
                  <Feather
                    name="refresh-cw"
                    size={16}
                    color={AppColors.primary}
                  />
                )}
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={AppColors.primary} />
                <ThemedText
                  style={[
                    styles.loadingText,
                    { color: AppColors.secondaryText },
                  ]}
                >
                  {isLoadingLocation
                    ? "Getting your location..."
                    : "Finding nearby restaurants..."}
                </ThemedText>
              </View>
            ) : null
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
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
                {selectedRestaurant?.name}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={AppColors.text} />
              </TouchableOpacity>
            </View>

            {selectedRestaurant?.vicinity ? (
              <ThemedText
                style={[
                  styles.modalAddress,
                  { color: AppColors.secondaryText },
                ]}
              >
                {selectedRestaurant.vicinity}
              </ThemedText>
            ) : null}

            {selectedRestaurant ? (
              <View style={styles.modalMeta}>
                {selectedRestaurant.rating ? (
                  <View style={styles.modalMetaItem}>
                    <Ionicons name="star" size={16} color={AppColors.warning} />
                    <ThemedText style={styles.modalMetaText}>
                      {selectedRestaurant.rating} (
                      {selectedRestaurant.user_ratings_total || 0} reviews)
                    </ThemedText>
                  </View>
                ) : null}
                {(selectedRestaurant as any).distance ? (
                  <View style={styles.modalMetaItem}>
                    <Ionicons
                      name="navigate-outline"
                      size={16}
                      color={AppColors.primary}
                    />
                    <ThemedText style={styles.modalMetaText}>
                      {formatDistance((selectedRestaurant as any).distance)}
                    </ThemedText>
                  </View>
                ) : null}
                {selectedRestaurant.opening_hours ? (
                  <View
                    style={[
                      styles.modalStatusBadge,
                      {
                        backgroundColor: selectedRestaurant.opening_hours
                          .open_now
                          ? AppColors.success + "20"
                          : AppColors.destructive + "20",
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: selectedRestaurant.opening_hours.open_now
                          ? AppColors.success
                          : AppColors.destructive,
                      }}
                    >
                      {selectedRestaurant.opening_hours.open_now
                        ? "Open Now"
                        : "Closed"}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.modalQuickActions}>
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: AppColors.surface },
                ]}
                onPress={() => {
                  if (!selectedRestaurant) return;
                  const { lat, lng } = selectedRestaurant.geometry.location;
                  const label = encodeURIComponent(selectedRestaurant.name);
                  const url = Platform.select({
                    ios: `maps://app?daddr=${lat},${lng}&q=${label}`,
                    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${selectedRestaurant.place_id}`,
                  });
                  if (url) Linking.openURL(url);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate" size={20} color={AppColors.primary} />
                <ThemedText
                  style={[styles.quickActionText, { color: AppColors.primary }]}
                >
                  Directions
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: AppColors.surface },
                ]}
                onPress={() => {
                  if (!selectedRestaurant) return;
                  const query = encodeURIComponent(
                    selectedRestaurant.name +
                      " " +
                      (selectedRestaurant.vicinity || ""),
                  );
                  Linking.openURL(`https://www.google.com/search?q=${query}`);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={20} color={AppColors.primary} />
                <ThemedText
                  style={[styles.quickActionText, { color: AppColors.primary }]}
                >
                  Contact
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: AppColors.primaryDark },
                ]}
                onPress={handleScanMenu}
                activeOpacity={0.8}
              >
                <Feather name="camera" size={18} color={AppColors.buttonText} />
                <ThemedText style={styles.primaryButtonText}>
                  Scan Menu
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: AppColors.surface,
                    borderColor: AppColors.primary,
                  },
                  isLoadingSuggestions && { opacity: 0.6 },
                ]}
                onPress={handleSuggestSafeDishes}
                disabled={isLoadingSuggestions}
                activeOpacity={0.8}
              >
                {isLoadingSuggestions ? (
                  <ActivityIndicator size="small" color={AppColors.primary} />
                ) : (
                  <Feather
                    name="check-circle"
                    size={18}
                    color={AppColors.primary}
                  />
                )}
                <ThemedText
                  style={[
                    styles.secondaryButtonText,
                    { color: AppColors.primary },
                  ]}
                >
                  {isLoadingSuggestions ? "Loading..." : "Suggest Safe Dishes"}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {suggestionsError ? (
              <View
                style={[
                  styles.suggestionsError,
                  { backgroundColor: AppColors.destructive + "20" },
                ]}
              >
                <Feather
                  name="alert-circle"
                  size={16}
                  color={AppColors.destructive}
                />
                <ThemedText
                  style={[
                    styles.suggestionsErrorText,
                    { color: AppColors.destructive },
                  ]}
                >
                  {suggestionsError}
                </ThemedText>
              </View>
            ) : null}

            {suggestions.length > 0 ? (
              <View style={styles.suggestionsContainer}>
                <ThemedText style={styles.suggestionsTitle}>
                  Safe Dishes for You
                </ThemedText>
                {suggestions.map((dish, index) => (
                  <View
                    key={index}
                    style={[
                      styles.suggestionItem,
                      { backgroundColor: AppColors.surface },
                    ]}
                  >
                    <View
                      style={[
                        styles.suggestionNumber,
                        { backgroundColor: AppColors.primaryDark },
                      ]}
                    >
                      <ThemedText style={styles.suggestionNumberText}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.suggestionText}>
                      {dish}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.destructive + "20",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    margin: Spacing.md,
    marginTop: 100,
    gap: Spacing.sm,
  },
  errorText: {
    color: AppColors.destructive,
    fontSize: 14,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
  },
  findButton: {
    paddingHorizontal: Spacing["2xl"],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: 16,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: "500",
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  restaurantAddress: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  restaurantMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  reviewCount: {
    fontSize: 12,
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "500",
  },
  openStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  openStatusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalAddress: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  modalMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  modalMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalMetaText: {
    fontSize: 14,
    color: AppColors.secondaryText,
  },
  modalStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  modalQuickActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: AppColors.divider,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalActions: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    width: "100%",
  },
  suggestionsError: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  suggestionsErrorText: {
    fontSize: 14,
    flex: 1,
  },
  suggestionsContainer: {
    marginTop: Spacing.md,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  suggestionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.buttonText,
  },
  suggestionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.buttonText,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
