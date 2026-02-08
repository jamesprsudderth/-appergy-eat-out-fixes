import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RestaurantStackParamList } from "@/navigation/RestaurantStackNavigator";
import { MenuItemResult } from "@/services/ai";

type MenuResultsScreenNavigationProp = NativeStackNavigationProp<
  RestaurantStackParamList,
  "MenuResults"
>;
type MenuResultsScreenRouteProp = RouteProp<
  RestaurantStackParamList,
  "MenuResults"
>;

export default function MenuResultsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<MenuResultsScreenNavigationProp>();
  const route = useRoute<MenuResultsScreenRouteProp>();
  const [selectedItem, setSelectedItem] = useState<MenuItemResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { menuItems, restaurantName } = route.params;

  const safeItems = menuItems.filter((item) => item.verdict === "Safe");
  const unsafeItems = menuItems.filter((item) => item.verdict === "Unsafe");

  const handleItemPress = (item: MenuItemResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleScanAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const renderMenuItem = (item: MenuItemResult, index: number) => {
    const isSafe = item.verdict === "Safe";
    const statusColor = isSafe ? AppColors.success : AppColors.destructive;

    return (
      <TouchableOpacity
        key={`${item.name}-${index}`}
        style={[styles.menuItemCard, { backgroundColor: AppColors.surface }]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemHeader}>
          <View style={styles.menuItemInfo}>
            <ThemedText style={styles.menuItemName} numberOfLines={2}>
              {item.name}
            </ThemedText>
            {item.price ? (
              <ThemedText
                style={[
                  styles.menuItemPrice,
                  { color: AppColors.secondaryText },
                ]}
              >
                {item.price}
              </ThemedText>
            ) : null}
          </View>
          <View
            style={[
              styles.verdictBadge,
              { backgroundColor: statusColor + "20" },
            ]}
          >
            <Ionicons
              name={isSafe ? "checkmark-circle" : "alert-circle"}
              size={16}
              color={statusColor}
            />
            <ThemedText style={[styles.verdictText, { color: statusColor }]}>
              {item.verdict}
            </ThemedText>
          </View>
        </View>

        {item.description ? (
          <ThemedText
            style={[
              styles.menuItemDescription,
              { color: AppColors.secondaryText },
            ]}
            numberOfLines={2}
          >
            {item.description}
          </ThemedText>
        ) : null}

        {item.conflicts.length > 0 ? (
          <View style={styles.conflictPreview}>
            <Feather
              name="alert-triangle"
              size={12}
              color={AppColors.warning}
            />
            <ThemedText
              style={[styles.conflictPreviewText, { color: AppColors.warning }]}
            >
              {item.conflicts.length} potential issue
              {item.conflicts.length !== 1 ? "s" : ""} - tap for details
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.ingredientPreview}>
          <ThemedText
            style={[styles.ingredientLabel, { color: AppColors.secondaryText }]}
          >
            Inferred ingredients:
          </ThemedText>
          <ThemedText
            style={[styles.ingredientList, { color: AppColors.secondaryText }]}
            numberOfLines={1}
          >
            {item.inferred_ingredients.join(", ")}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing["4xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Menu Analysis</ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: AppColors.secondaryText }]}
          >
            {restaurantName}
          </ThemedText>
        </View>

        <View style={styles.summary}>
          <View
            style={[
              styles.summaryItem,
              { backgroundColor: AppColors.success + "15" },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={AppColors.success}
            />
            <ThemedText style={styles.summaryCount}>
              {safeItems.length}
            </ThemedText>
            <ThemedText
              style={[styles.summaryLabel, { color: AppColors.secondaryText }]}
            >
              Safe
            </ThemedText>
          </View>
          <View
            style={[
              styles.summaryItem,
              { backgroundColor: AppColors.destructive + "15" },
            ]}
          >
            <Ionicons
              name="alert-circle"
              size={24}
              color={AppColors.destructive}
            />
            <ThemedText style={styles.summaryCount}>
              {unsafeItems.length}
            </ThemedText>
            <ThemedText
              style={[styles.summaryLabel, { color: AppColors.secondaryText }]}
            >
              Unsafe
            </ThemedText>
          </View>
        </View>

        {safeItems.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={AppColors.success}
              />
              <ThemedText style={styles.sectionTitle}>Safe Options</ThemedText>
            </View>
            {safeItems.map((item, index) => renderMenuItem(item, index))}
          </View>
        ) : null}

        {unsafeItems.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="alert-circle"
                size={20}
                color={AppColors.destructive}
              />
              <ThemedText style={styles.sectionTitle}>
                Items to Avoid
              </ThemedText>
            </View>
            {unsafeItems.map((item, index) => renderMenuItem(item, index))}
          </View>
        ) : null}

        <Button onPress={handleScanAnother} style={styles.scanAnotherButton}>
          <Feather name="camera" size={20} color="#fff" />
          <ThemedText style={styles.scanAnotherText}>
            Scan Another Menu
          </ThemedText>
        </Button>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: AppColors.background },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              { paddingTop: insets.top + Spacing.md },
            ]}
          >
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color={AppColors.text} />
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>Item Details</ThemedText>
            <View style={styles.modalCloseButton} />
          </View>

          {selectedItem ? (
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={{
                paddingBottom: insets.bottom + Spacing.xl,
              }}
            >
              <View style={styles.modalItemHeader}>
                <ThemedText style={styles.modalItemName}>
                  {selectedItem.name}
                </ThemedText>
                {selectedItem.price ? (
                  <ThemedText
                    style={[
                      styles.modalItemPrice,
                      { color: AppColors.primary },
                    ]}
                  >
                    {selectedItem.price}
                  </ThemedText>
                ) : null}
              </View>

              <View
                style={[
                  styles.modalVerdictBadge,
                  {
                    backgroundColor:
                      selectedItem.verdict === "Safe"
                        ? AppColors.success + "20"
                        : AppColors.destructive + "20",
                  },
                ]}
              >
                <Ionicons
                  name={
                    selectedItem.verdict === "Safe"
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={24}
                  color={
                    selectedItem.verdict === "Safe"
                      ? AppColors.success
                      : AppColors.destructive
                  }
                />
                <ThemedText
                  style={[
                    styles.modalVerdictText,
                    {
                      color:
                        selectedItem.verdict === "Safe"
                          ? AppColors.success
                          : AppColors.destructive,
                    },
                  ]}
                >
                  {selectedItem.verdict === "Safe"
                    ? "Safe for you to eat"
                    : "Contains potential allergens"}
                </ThemedText>
              </View>

              {selectedItem.description ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle}>
                    Description
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.modalSectionText,
                      { color: AppColors.secondaryText },
                    ]}
                  >
                    {selectedItem.description}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.modalSection}>
                <ThemedText style={styles.modalSectionTitle}>
                  Inferred Ingredients
                </ThemedText>
                <View style={styles.ingredientTags}>
                  {selectedItem.inferred_ingredients.map((ingredient, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.ingredientTag,
                        { backgroundColor: AppColors.surfaceSecondary },
                      ]}
                    >
                      <ThemedText style={styles.ingredientTagText}>
                        {ingredient}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>

              {selectedItem.conflicts.length > 0 ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle}>
                    Conflicts Detected
                  </ThemedText>
                  {selectedItem.conflicts.map((conflict, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.conflictCard,
                        { backgroundColor: AppColors.destructive + "10" },
                      ]}
                    >
                      <View style={styles.conflictHeader}>
                        <Ionicons
                          name={
                            conflict.type === "allergy_risk"
                              ? "warning"
                              : conflict.type === "preference_mismatch"
                                ? "information-circle"
                                : "ban"
                          }
                          size={18}
                          color={
                            conflict.type === "allergy_risk"
                              ? AppColors.destructive
                              : conflict.type === "preference_mismatch"
                                ? AppColors.warning
                                : AppColors.secondaryText
                          }
                        />
                        <ThemedText style={styles.conflictType}>
                          {conflict.type === "allergy_risk"
                            ? "Allergy Risk"
                            : conflict.type === "preference_mismatch"
                              ? "Preference Mismatch"
                              : "Forbidden Keyword"}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          styles.conflictName,
                          { color: AppColors.destructive },
                        ]}
                      >
                        {conflict.conflict}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.conflictDetail,
                          { color: AppColors.secondaryText },
                        ]}
                      >
                        {conflict.detail}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
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
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    marginTop: Spacing.xs,
  },
  summary: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  summaryItem: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  summaryCount: {
    fontSize: 28,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 14,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  menuItemCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  menuItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  menuItemInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: "600",
  },
  menuItemPrice: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  verdictBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  verdictText: {
    fontSize: 12,
    fontWeight: "600",
  },
  menuItemDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  conflictPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  conflictPreviewText: {
    fontSize: 12,
  },
  ingredientPreview: {
    marginTop: Spacing.xs,
  },
  ingredientLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  ingredientList: {
    fontSize: 12,
  },
  scanAnotherButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  scanAnotherText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  modalItemHeader: {
    marginBottom: Spacing.md,
  },
  modalItemName: {
    fontSize: 24,
    fontWeight: "700",
  },
  modalItemPrice: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  modalVerdictBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modalVerdictText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalSection: {
    marginBottom: Spacing.xl,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  modalSectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  ingredientTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  ingredientTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  ingredientTagText: {
    fontSize: 14,
  },
  conflictCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  conflictHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  conflictType: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  conflictName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  conflictDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
});
