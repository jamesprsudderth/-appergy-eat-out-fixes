import React from "react";
import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();

  const handleNearbyRestaurants = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("RestaurantsTab", { screen: "NearbyRestaurants" });
  };

  const handleScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ScanTab");
  };

  const handleScanGrocery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ScanTab", { screen: "GroceryScan" });
  };

  const handleScanMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("RestaurantsTab", {
      screen: "MenuScan",
      params: { restaurantName: "Restaurant" },
    });
  };

  const handleFindRecipes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("RecipesTab");
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: AppColors.background }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/login-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText style={styles.title}>Welcome to Appergy</ThemedText>
        <ThemedText
          style={[styles.description, { color: AppColors.secondaryText }]}
        >
          Scan food labels and menus to check for allergens. Your safety is our
          priority.
        </ThemedText>
      </View>

      <View style={styles.quickActions}>
        <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: AppColors.surface }]}
          onPress={handleScan}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: AppColors.primary + "20" },
            ]}
          >
            <Ionicons name="camera" size={28} color={AppColors.primary} />
          </View>
          <View style={styles.actionContent}>
            <ThemedText style={styles.actionTitle}>Scan Food Label</ThemedText>
            <ThemedText
              style={[
                styles.actionDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Take a photo of any food label or menu to check for allergens
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={AppColors.secondaryText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: AppColors.surface }]}
          onPress={handleScanGrocery}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: AppColors.primaryLight + "20" },
            ]}
          >
            <Ionicons
              name="barcode-outline"
              size={28}
              color={AppColors.primaryLight}
            />
          </View>
          <View style={styles.actionContent}>
            <ThemedText style={styles.actionTitle}>Scan Grocery</ThemedText>
            <ThemedText
              style={[
                styles.actionDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Scan product barcodes to check for allergens before you buy
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={AppColors.secondaryText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: AppColors.surface }]}
          onPress={handleScanMenu}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: AppColors.info + "20" },
            ]}
          >
            <Ionicons
              name="book-outline"
              size={28}
              color={AppColors.info}
            />
          </View>
          <View style={styles.actionContent}>
            <ThemedText style={styles.actionTitle}>Scan Menu</ThemedText>
            <ThemedText
              style={[
                styles.actionDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Scan a restaurant menu to find safe dishes for you
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={AppColors.secondaryText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: AppColors.surface }]}
          onPress={handleNearbyRestaurants}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: AppColors.success + "20" },
            ]}
          >
            <Ionicons name="location" size={28} color={AppColors.success} />
          </View>
          <View style={styles.actionContent}>
            <ThemedText style={styles.actionTitle}>
              Nearby Safe Restaurants
            </ThemedText>
            <ThemedText
              style={[
                styles.actionDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Find restaurants near you and get personalized dish suggestions
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={AppColors.secondaryText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: AppColors.surface }]}
          onPress={handleFindRecipes}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: AppColors.warning + "20" },
            ]}
          >
            <Ionicons name="restaurant" size={28} color={AppColors.warning} />
          </View>
          <View style={styles.actionContent}>
            <ThemedText style={styles.actionTitle}>Find Recipes</ThemedText>
            <ThemedText
              style={[
                styles.actionDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Generate safe recipes tailored to your allergies and preferences
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={AppColors.secondaryText}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  quickActions: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
