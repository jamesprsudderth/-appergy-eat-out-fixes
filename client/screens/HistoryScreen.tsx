import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import {
  getScanHistory,
  ScanHistoryItem,
  formatScanDate,
} from "@/services/scanHistory";

interface HistoryCardProps {
  item: ScanHistoryItem;
  onPress: () => void;
}

function HistoryCard({ item, onPress }: HistoryCardProps) {
  const hasUnsafe = item.unsafeCount > 0;
  const statusColor = hasUnsafe ? AppColors.destructive : AppColors.success;
  const statusIcon = hasUnsafe ? "warning" : "checkmark-circle";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: AppColors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View
          style={[styles.iconCircle, { backgroundColor: statusColor + "20" }]}
        >
          <Ionicons name={statusIcon} size={24} color={statusColor} />
        </View>
        <View style={styles.cardInfo}>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {item.productName ||
              (item.type === "barcode" ? "Product Scan" : "Menu/Label Scan")}
          </ThemedText>
          <ThemedText
            style={[styles.cardMeta, { color: AppColors.secondaryText }]}
          >
            {formatScanDate(item.timestamp)} • {item.ingredients.length}{" "}
            ingredients
          </ThemedText>
        </View>
        <View style={styles.cardStatus}>
          <View style={styles.statusBadges}>
            <View
              style={[
                styles.badge,
                { backgroundColor: AppColors.success + "20" },
              ]}
            >
              <ThemedText
                style={[styles.badgeText, { color: AppColors.success }]}
              >
                {item.safeCount}
              </ThemedText>
            </View>
            {item.unsafeCount > 0 ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: AppColors.destructive + "20" },
                ]}
              >
                <ThemedText
                  style={[styles.badgeText, { color: AppColors.destructive }]}
                >
                  {item.unsafeCount}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {item.ingredients.length > 0 ? (
        <View style={styles.ingredientsPreview}>
          <ThemedText
            style={[styles.ingredientsText, { color: AppColors.secondaryText }]}
            numberOfLines={1}
          >
            {item.ingredients.slice(0, 5).join(", ")}
            {item.ingredients.length > 5
              ? ` +${item.ingredients.length - 5} more`
              : ""}
          </ThemedText>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: AppColors.primary + "20" },
        ]}
      >
        <Ionicons name="time-outline" size={48} color={AppColors.primary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No Scan History</ThemedText>
      <ThemedText
        style={[styles.emptyDescription, { color: AppColors.secondaryText }]}
      >
        Your scanned food labels and menus will appear here. Start scanning to
        check for allergens!
      </ThemedText>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={AppColors.primary} />
      <ThemedText
        style={[styles.loadingText, { color: AppColors.secondaryText }]}
      >
        Loading history...
      </ThemedText>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: AppColors.destructive + "20" },
        ]}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={AppColors.destructive}
        />
      </View>
      <ThemedText style={styles.emptyTitle}>Unable to Load History</ThemedText>
      <ThemedText
        style={[styles.emptyDescription, { color: AppColors.secondaryText }]}
      >
        Please check your internet connection and try again.
      </ThemedText>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Ionicons name="refresh" size={20} color={AppColors.primary} />
        <ThemedText style={[styles.retryText, { color: AppColors.primary }]}>
          Try Again
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

export default function HistoryScreen() {
  useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (showLoader = true) => {
      if (!user) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      if (showLoader) setIsLoading(true);
      setError(null);

      try {
        const items = await getScanHistory(user.uid);
        setHistory(items);
      } catch (err) {
        console.error("Error loading history:", err);
        setError("Failed to load history");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadHistory(false);
  }, [loadHistory]);

  const handleItemPress = (item: ScanHistoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderItem = ({ item }: { item: ScanHistoryItem }) => (
    <HistoryCard item={item} onPress={() => handleItemPress(item)} />
  );

  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (error) {
      return <ErrorState onRetry={() => loadHistory()} />;
    }

    if (history.length === 0) {
      return <EmptyState />;
    }

    return (
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={AppColors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  cardStatus: {
    alignItems: "flex-end",
  },
  statusBadges: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    minWidth: 28,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ingredientsPreview: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppColors.divider,
  },
  ingredientsText: {
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: 16,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  retryText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
