import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { doc, getDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppColors } from "@/constants/colors";
import { AccountStackParamList } from "@/navigation/AccountStackNavigator";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured } from "@/services/firebase";
import { exportProfileAsPDF } from "@/services/profileExport";
import type { ProfileInfo } from "../../shared/types";

type AccountScreenNavigationProp = NativeStackNavigationProp<
  AccountStackParamList,
  "Account"
>;

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  warning?: boolean;
}

function SettingsItem({
  icon,
  label,
  onPress,
  destructive,
  warning,
}: SettingsItemProps) {
  const getIconColor = () => {
    if (destructive) return AppColors.destructive;
    if (warning) return AppColors.warning;
    return AppColors.secondaryText;
  };

  const getLabelColor = () => {
    if (destructive) return AppColors.destructive;
    if (warning) return AppColors.warning;
    return AppColors.text;
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.settingsItem, { backgroundColor: AppColors.surface }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.settingsItemLeft}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: AppColors.surfaceSecondary },
          ]}
        >
          <Ionicons name={icon} size={20} color={getIconColor()} />
        </View>
        <ThemedText style={[styles.settingsLabel, { color: getLabelColor() }]}>
          {label}
        </ThemedText>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={AppColors.secondaryText}
      />
    </TouchableOpacity>
  );
}

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <ThemedText
      style={[styles.sectionHeader, { color: AppColors.secondaryText }]}
    >
      {title}
    </ThemedText>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<AccountScreenNavigationProp>();
  const { user, logout } = useAuth();

  const [allergyCount, setAllergyCount] = useState(2);

  useEffect(() => {
    loadAllergyCount();
  }, [user]);

  const loadAllergyCount = async () => {
    if (!user || !isFirebaseConfigured || !db) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAllergyCount(data.mainProfile?.allergies?.length || 0);
      }
    } catch (error) {
      console.error("Error loading allergy count:", error);
    }
  };

  const handleProfilePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ProfileEdit");
  };

  const handleFamilyPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("FamilyProfiles");
  };

  const handleKeywordsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("KeywordManager");
  };

  const handleExportProfile = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!userProfile) {
      Alert.alert("No Profile", "Please set up your profile first.");
      return;
    }

    try {
      // Build ProfileInfo from AuthContext userProfile
      const mp = userProfile;
      const allergiesData = mp.allergies || {};
      const allAllergies = Array.isArray(allergiesData)
        ? allergiesData as unknown as string[]
        : [...(allergiesData.common || []), ...(allergiesData.custom || [])];

      const preferencesData = mp.preferences || {};
      const allPreferences = Array.isArray(preferencesData)
        ? preferencesData as unknown as string[]
        : [...(preferencesData.common || []), ...(preferencesData.custom || [])];

      const profileInfo: ProfileInfo = {
        id: "mainProfile",
        name: mp.name || "My Profile",
        allergies: allAllergies,
        customAllergies: Array.isArray(allergiesData) ? [] : (allergiesData.custom || []),
        preferences: allPreferences,
        forbiddenKeywords: mp.forbiddenKeywords || [],
        treatMayContainAsUnsafe: (mp as any).treatMayContainAsUnsafe ?? false,
        allergySeverity: (mp as any).allergySeverity || {},
        emergencyContact: (mp as any).emergencyContact || undefined,
      };

      await exportProfileAsPDF(
        profileInfo,
        user?.email || "Appergy User",
        90
      );
    } catch (error: any) {
      console.error("Export failed:", error);
      Alert.alert("Export Failed", "Could not generate profile PDF. Please try again.");
    }
  };

  const handleTermsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("TermsOfService");
  };

  const handleSettingsItemPress = (item: string) => {
    Alert.alert(item, `${item} screen coming soon!`);
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear Scan History",
      "Are you sure you want to clear all scan history? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Scan history cleared.");
          },
        },
      ],
    );
  };

  const handleResetProfile = () => {
    Alert.alert(
      "Reset Profile",
      "Are you sure you want to reset your profile? This will remove all allergies and preferences.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Success", "Profile has been reset.");
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await logout();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: AppColors.background }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing["3xl"],
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.profileCard, { backgroundColor: AppColors.surface }]}
        onPress={handleProfilePress}
        activeOpacity={0.8}
      >
        <View style={styles.profileCardContent}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: AppColors.primaryDark },
            ]}
          >
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          <View style={styles.profileTextContainer}>
            <ThemedText style={styles.profileTitle}>Your Profile</ThemedText>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={AppColors.secondaryText}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.familyCard, { backgroundColor: AppColors.surface }]}
        onPress={handleFamilyPress}
        activeOpacity={0.8}
      >
        <View style={styles.profileCardContent}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: AppColors.primary + "80" },
            ]}
          >
            <Ionicons name="people" size={28} color={AppColors.primary} />
          </View>
          <View style={styles.profileTextContainer}>
            <ThemedText style={styles.profileTitle}>Family Members</ThemedText>
            <ThemedText
              style={[
                styles.profileSubtitle,
                { color: AppColors.secondaryText },
              ]}
            >
              Manage up to 4 profiles
            </ThemedText>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={AppColors.secondaryText}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.keywordsCard, { backgroundColor: AppColors.surface }]}
        onPress={handleKeywordsPress}
        activeOpacity={0.8}
      >
        <View style={styles.profileCardContent}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: AppColors.destructive + "20" },
            ]}
          >
            <Ionicons name="ban" size={28} color={AppColors.destructive} />
          </View>
          <View style={styles.profileTextContainer}>
            <ThemedText style={styles.profileTitle}>
              Forbidden Keywords
            </ThemedText>
            <ThemedText
              style={[
                styles.profileSubtitle,
                { color: AppColors.secondaryText },
              ]}
            >
              Custom ingredients to avoid
            </ThemedText>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={AppColors.secondaryText}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.keywordsCard, { backgroundColor: AppColors.surface }]}
        onPress={() => navigation.navigate("RecipesHistory")}
        activeOpacity={0.8}
      >
        <View style={styles.profileCardContent}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: AppColors.primary + "20" },
            ]}
          >
            <Ionicons name="book" size={28} color={AppColors.primary} />
          </View>
          <View style={styles.profileTextContainer}>
            <ThemedText style={styles.profileTitle}>
              My Saved Recipes
            </ThemedText>
            <ThemedText
              style={[
                styles.profileSubtitle,
                { color: AppColors.secondaryText },
              ]}
            >
              View and manage your saved recipes
            </ThemedText>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={AppColors.secondaryText}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.keywordsCard, { backgroundColor: AppColors.surface }]}
        onPress={handleExportProfile}
        activeOpacity={0.8}
      >
        <View style={styles.profileCardContent}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: AppColors.info + "20" },
            ]}
          >
            <Ionicons name="download-outline" size={28} color={AppColors.info} />
          </View>
          <View style={styles.profileTextContainer}>
            <ThemedText style={styles.profileTitle}>
              Export Profile Card
            </ThemedText>
            <ThemedText
              style={[
                styles.profileSubtitle,
                { color: AppColors.secondaryText },
              ]}
            >
              PDF with allergies, severity levels &amp; emergency contact
            </ThemedText>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={AppColors.secondaryText}
        />
      </TouchableOpacity>

      <SectionHeader title="SETTINGS" />
      <View style={styles.section}>
        <SettingsItem
          icon="notifications-outline"
          label="Notifications"
          onPress={() => handleSettingsItemPress("Notifications")}
        />
        <View
          style={[styles.divider, { backgroundColor: AppColors.divider }]}
        />
        <SettingsItem
          icon="moon-outline"
          label="Appearance"
          onPress={() => handleSettingsItemPress("Appearance")}
        />
      </View>

      <SectionHeader title="SUPPORT" />
      <View style={styles.section}>
        <SettingsItem
          icon="help-circle-outline"
          label="Help & FAQ"
          onPress={() => handleSettingsItemPress("Help & FAQ")}
        />
        <View
          style={[styles.divider, { backgroundColor: AppColors.divider }]}
        />
        <SettingsItem
          icon="mail-outline"
          label="Contact Support"
          onPress={() => handleSettingsItemPress("Contact Support")}
        />
        <View
          style={[styles.divider, { backgroundColor: AppColors.divider }]}
        />
        <SettingsItem
          icon="star-outline"
          label="Rate App"
          onPress={() => handleSettingsItemPress("Rate App")}
        />
      </View>

      <SectionHeader title="LEGAL" />
      <View style={styles.section}>
        <SettingsItem
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => handleSettingsItemPress("Privacy Policy")}
        />
        <View
          style={[styles.divider, { backgroundColor: AppColors.divider }]}
        />
        <SettingsItem
          icon="document-text-outline"
          label="Terms of Service"
          onPress={handleTermsPress}
        />
      </View>

      <SectionHeader title="DATA" />
      <View style={styles.section}>
        <SettingsItem
          icon="trash-outline"
          label="Clear Scan History"
          onPress={handleClearHistory}
          destructive
        />
        <View
          style={[styles.divider, { backgroundColor: AppColors.divider }]}
        />
        <SettingsItem
          icon="refresh-outline"
          label="Reset Profile"
          onPress={handleResetProfile}
          warning
        />
      </View>

      <SectionHeader title="ACCOUNT" />
      <View style={styles.section}>
        {user?.email ? (
          <View
            style={[styles.emailRow, { backgroundColor: AppColors.surface }]}
          >
            <View style={styles.settingsItemLeft}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: AppColors.surfaceSecondary },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={AppColors.secondaryText}
                />
              </View>
              <ThemedText
                style={[
                  styles.settingsLabel,
                  { color: AppColors.secondaryText },
                ]}
                numberOfLines={1}
              >
                {user.email}
              </ThemedText>
            </View>
          </View>
        ) : null}
        {user?.email ? (
          <View
            style={[styles.divider, { backgroundColor: AppColors.divider }]}
          />
        ) : null}
        <SettingsItem
          icon="log-out-outline"
          label="Sign Out"
          onPress={handleLogout}
          destructive
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <ThemedText
            style={[styles.footerText, { color: AppColors.secondaryText }]}
          >
            Made with
          </ThemedText>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <ThemedText
            style={[styles.footerText, { color: AppColors.secondaryText }]}
          >
            Replit
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  familyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  keywordsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  profileCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  profileTextContainer: {
    marginLeft: Spacing.md,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  profileSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  section: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  settingsItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingsLabel: {
    fontSize: 16,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  footer: {
    marginTop: Spacing["4xl"],
    alignItems: "center",
    paddingBottom: Spacing.lg,
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
  },
  footerLogo: {
    width: 16,
    height: 16,
    marginHorizontal: 4,
  },
});
