import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAdminAlerts,
  markAlertAsRead,
  type AdminAlert,
} from "@/services/adminAlerts";

type AlertWithId = AdminAlert & { id: string };

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState<AlertWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchAdminAlerts(user.uid);
      setAlerts(data);
    } catch {
      // errors handled inside fetchAdminAlerts
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const handleMarkRead = async (alertId: string) => {
    if (!user) return;
    const success = await markAlertAsRead(user.uid, alertId);
    if (success) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)),
      );
    }
  };

  const renderAlert = ({ item }: { item: AlertWithId }) => (
    <View
      style={[
        styles.alertCard,
        {
          backgroundColor: item.isRead
            ? AppColors.surface
            : AppColors.destructive + "08",
          borderLeftColor: item.isRead
            ? AppColors.divider
            : AppColors.destructive,
        },
      ]}
    >
      <View style={styles.alertHeader}>
        <View style={styles.alertIconContainer}>
          <Ionicons name="warning" size={20} color={AppColors.destructive} />
        </View>
        <ThemedText style={styles.alertTitle}>Allergen Alert</ThemedText>
        {!item.isRead && (
          <View
            style={[
              styles.unreadBadge,
              { backgroundColor: AppColors.destructive },
            ]}
          />
        )}
      </View>

      <ThemedText style={[styles.alertSummary, { color: AppColors.text }]}>
        {item.summary}
      </ThemedText>

      {item.allergens.length > 0 && (
        <View style={styles.allergenTags}>
          {item.allergens.map((allergen) => (
            <View
              key={allergen}
              style={[
                styles.allergenTag,
                { backgroundColor: AppColors.destructive + "15" },
              ]}
            >
              <ThemedText
                style={[
                  styles.allergenTagText,
                  { color: AppColors.destructive },
                ]}
              >
                {allergen}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      {!item.isRead && (
        <TouchableOpacity
          style={[styles.markReadButton, { borderColor: AppColors.divider }]}
          onPress={() => handleMarkRead(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={AppColors.secondaryText}
          />
          <ThemedText
            style={[styles.markReadText, { color: AppColors.secondaryText }]}
          >
            Mark as read
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: AppColors.background,
            paddingTop: headerHeight,
          },
        ]}
      >
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={AppColors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={AppColors.primary}
            />
            <ThemedText style={[styles.emptyTitle, { color: AppColors.text }]}>
              No Alerts
            </ThemedText>
            <ThemedText
              style={[styles.emptySubtitle, { color: AppColors.secondaryText }]}
            >
              Allergen alerts will appear here when detected during scans.
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  alertCard: {
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  alertIconContainer: {
    marginRight: Spacing.sm,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertSummary: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  allergenTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  allergenTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  allergenTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  markReadButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  markReadText: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
