import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";

type RoleSelectionNavigationProp = NativeStackNavigationProp<any>;

export default function RoleSelectionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RoleSelectionNavigationProp>();

  const handleParentRole = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("FamilyManagement");
  };

  const handleMemberRole = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("AllergySetup");
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: AppColors.background,
          paddingTop: insets.top + Spacing["4xl"],
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: AppColors.primary + "20" },
          ]}
        >
          <Feather name="users" size={48} color={AppColors.primary} />
        </View>
        <ThemedText style={styles.title}>
          What is your role in the family?
        </ThemedText>
        <ThemedText
          style={[styles.subtitle, { color: AppColors.secondaryText }]}
        >
          This helps us customize your experience with Appergy.
        </ThemedText>
      </View>

      <View style={styles.options}>
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleParentRole}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.optionIcon,
              { backgroundColor: AppColors.primary + "20" },
            ]}
          >
            <Feather name="shield" size={32} color={AppColors.primary} />
          </View>
          <View style={styles.optionContent}>
            <ThemedText style={styles.optionTitle}>
              I am the Parent / Admin
            </ThemedText>
            <ThemedText
              style={[
                styles.optionDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Manage family members, set up allergies and preferences for
              everyone, and control who can scan.
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={24}
            color={AppColors.secondaryText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleMemberRole}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.optionIcon,
              { backgroundColor: AppColors.primaryLight + "40" },
            ]}
          >
            <Feather name="user" size={32} color={AppColors.primaryLight} />
          </View>
          <View style={styles.optionContent}>
            <ThemedText style={styles.optionTitle}>
              I am a Family Member
            </ThemedText>
            <ThemedText
              style={[
                styles.optionDescription,
                { color: AppColors.secondaryText },
              ]}
            >
              Set up your personal profile only. A parent or admin will manage
              the family settings.
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={24}
            color={AppColors.secondaryText}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <ThemedText
          style={[styles.footerText, { color: AppColors.secondaryText }]}
        >
          You can change this later in your account settings.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  options: {
    flex: 1,
    gap: Spacing.lg,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  footerText: {
    fontSize: 13,
    textAlign: "center",
  },
});
