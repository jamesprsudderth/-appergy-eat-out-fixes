import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { db, isFirebaseConfigured } from "@/services/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAddFamilyMember,
  getSubscriptionInfo,
  PLAN_DETAILS,
  SubscriptionInfo,
} from "@/services/subscription";

/*
 * Firestore Data Model:
 *
 * Collection: users/{uid}/familyProfiles
 * Documents: member1, member2, member3, member4
 * {
 *   name: string,
 *   allergies: string[],
 *   preferences: string[],
 *   updatedAt: timestamp
 * }
 */

const MAX_FAMILY_MEMBERS = 4;

const ALLERGY_OPTIONS = [
  "Peanuts",
  "Tree Nuts",
  "Dairy",
  "Eggs",
  "Gluten",
  "Wheat",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
];

const PREFERENCE_OPTIONS = [
  "Vegan",
  "Vegetarian",
  "Gluten-Free",
  "Dairy-Free",
  "Low-Sodium",
  "Low-Sugar",
  "Keto",
  "Paleo",
  "Halal",
  "Kosher",
];

interface FamilyMember {
  id: string;
  name: string;
  allergies: string[];
  preferences: string[];
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  variant?: "allergy" | "preference";
}

function Chip({ label, selected, onPress, variant = "allergy" }: ChipProps) {
  const backgroundColor = selected
    ? variant === "allergy"
      ? AppColors.destructive
      : AppColors.primary
    : AppColors.surface;

  return (
    <TouchableOpacity
      style={[styles.chip, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ThemedText
        style={[
          styles.chipText,
          { color: selected ? AppColors.text : AppColors.secondaryText },
        ]}
      >
        {label}
      </ThemedText>
      {selected ? (
        <Feather
          name="check"
          size={14}
          color={AppColors.text}
          style={styles.chipIcon}
        />
      ) : null}
    </TouchableOpacity>
  );
}

interface MemberCardProps {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
}

function MemberCard({ member, onEdit, onDelete }: MemberCardProps) {
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatar}>
          <Feather name="user" size={24} color={AppColors.primary} />
        </View>
        <View style={styles.memberDetails}>
          <ThemedText style={styles.memberName}>{member.name}</ThemedText>
          <ThemedText
            style={[styles.memberMeta, { color: AppColors.secondaryText }]}
          >
            {member.allergies.length} allergies, {member.preferences.length}{" "}
            preferences
          </ThemedText>
        </View>
      </View>
      <View style={styles.memberActions}>
        <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
          <Feather name="edit-2" size={18} color={AppColors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
          <Feather name="trash-2" size={18} color={AppColors.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FamilyProfilesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberName, setMemberName] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] =
    useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    loadFamilyMembers();
    loadSubscriptionInfo();
  }, [user]);

  const loadSubscriptionInfo = async () => {
    const info = await getSubscriptionInfo();
    setSubscriptionInfo(info);
  };

  const loadFamilyMembers = async () => {
    if (!user || !isFirebaseConfigured || !db) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const members: FamilyMember[] = [];
      for (let i = 1; i <= MAX_FAMILY_MEMBERS; i++) {
        const docRef = doc(
          db,
          "users",
          user.uid,
          "familyProfiles",
          `member${i}`,
        );
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          members.push({
            id: `member${i}`,
            name: data.name || "",
            allergies: data.allergies || [],
            preferences: data.preferences || [],
          });
        }
      }
      setFamilyMembers(members);
    } catch (error) {
      console.error("Error loading family members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = async () => {
    if (familyMembers.length >= MAX_FAMILY_MEMBERS) {
      Alert.alert(
        "Limit Reached",
        `You can add up to ${MAX_FAMILY_MEMBERS} family members.`,
      );
      return;
    }

    const check = await canAddFamilyMember(familyMembers.length + 1);
    if (!check.allowed) {
      setUpgradeModalVisible(true);
      return;
    }

    setEditingMember(null);
    setMemberName("");
    setSelectedAllergies([]);
    setSelectedPreferences([]);
    setModalVisible(true);
  };

  const openEditModal = (member: FamilyMember) => {
    setEditingMember(member);
    setMemberName(member.name);
    setSelectedAllergies(member.allergies);
    setSelectedPreferences(member.preferences);
    setModalVisible(true);
  };

  const toggleAllergy = (allergy: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((a) => a !== allergy)
        : [...prev, allergy],
    );
  };

  const togglePreference = (preference: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPreferences((prev) =>
      prev.includes(preference)
        ? prev.filter((p) => p !== preference)
        : [...prev, preference],
    );
  };

  const handleSaveMember = async () => {
    if (!memberName.trim()) {
      Alert.alert("Error", "Please enter a name for this family member.");
      return;
    }

    if (!isFirebaseConfigured || !db || !user) {
      Alert.alert(
        "Error",
        "Firebase is not configured or you are not logged in.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const memberId = editingMember?.id || `member${familyMembers.length + 1}`;
      const docRef = doc(db, "users", user.uid, "familyProfiles", memberId);
      await setDoc(docRef, {
        name: memberName.trim(),
        allergies: selectedAllergies,
        preferences: selectedPreferences,
        updatedAt: new Date().toISOString(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      loadFamilyMembers();
    } catch (error) {
      console.error("Error saving family member:", error);
      Alert.alert("Error", "Failed to save family member.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = (member: FamilyMember) => {
    Alert.alert(
      "Delete Family Member",
      `Are you sure you want to remove ${member.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!isFirebaseConfigured || !db || !user) return;
            try {
              const docRef = doc(
                db,
                "users",
                user.uid,
                "familyProfiles",
                member.id,
              );
              await deleteDoc(docRef);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              loadFamilyMembers();
            } catch (error) {
              console.error("Error deleting family member:", error);
              Alert.alert("Error", "Failed to delete family member.");
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
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
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing["4xl"],
          paddingHorizontal: Spacing.lg,
        }}
      >
        <ThemedText style={styles.description}>
          Add family members to track their allergies and preferences when
          scanning.
        </ThemedText>

        {familyMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: AppColors.primary + "20" },
              ]}
            >
              <Feather name="users" size={48} color={AppColors.primary} />
            </View>
            <ThemedText style={styles.emptyTitle}>No Family Members</ThemedText>
            <ThemedText
              style={[styles.emptyText, { color: AppColors.secondaryText }]}
            >
              Add up to {MAX_FAMILY_MEMBERS} family members to track their
              dietary needs.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.membersList}>
            {familyMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={() => openEditModal(member)}
                onDelete={() => handleDeleteMember(member)}
              />
            ))}
          </View>
        )}

        {familyMembers.length < MAX_FAMILY_MEMBERS ? (
          <Button onPress={openAddModal} style={styles.addButton}>
            Add Family Member
          </Button>
        ) : null}

        {subscriptionInfo && subscriptionInfo.tier !== "family" ? (
          <View style={styles.upgradeCard}>
            <Feather name="star" size={24} color={AppColors.warning} />
            <ThemedText style={styles.upgradeTitle}>
              Unlock Family Profiles
            </ThemedText>
            <ThemedText
              style={[styles.upgradeText, { color: AppColors.secondaryText }]}
            >
              Upgrade to the Family plan to add up to 4 profiles
            </ThemedText>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={upgradeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUpgradeModalVisible(false)}
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
              { paddingTop: insets.top + Spacing.lg },
            ]}
          >
            <TouchableOpacity onPress={() => setUpgradeModalVisible(false)}>
              <ThemedText
                style={[styles.modalCancel, { color: AppColors.primary }]}
              >
                Close
              </ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>Upgrade Required</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          <View style={styles.upgradeContent}>
            <View
              style={[
                styles.upgradeIcon,
                { backgroundColor: AppColors.warning + "20" },
              ]}
            >
              <Feather name="star" size={48} color={AppColors.warning} />
            </View>
            <ThemedText style={styles.upgradeModalTitle}>
              Family Plan Required
            </ThemedText>
            <ThemedText
              style={[
                styles.upgradeModalText,
                { color: AppColors.secondaryText },
              ]}
            >
              To add family profiles, upgrade to our Family plan.
            </ThemedText>

            <View style={styles.planCard}>
              <ThemedText style={styles.planName}>
                {PLAN_DETAILS.family.name}
              </ThemedText>
              <ThemedText style={styles.planPrice}>
                {PLAN_DETAILS.family.price}
              </ThemedText>
              <View style={styles.planFeatures}>
                {PLAN_DETAILS.family.features.map((feature, index) => (
                  <View key={index} style={styles.planFeatureRow}>
                    <Feather name="check" size={16} color={AppColors.primary} />
                    <ThemedText style={styles.planFeatureText}>
                      {feature}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            <Button
              onPress={() => {
                setUpgradeModalVisible(false);
                Alert.alert(
                  "Coming Soon",
                  "Subscriptions will be available soon!",
                );
              }}
              style={styles.upgradeButton}
            >
              Upgrade Now
            </Button>
          </View>
        </View>
      </Modal>

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
              { paddingTop: insets.top + Spacing.lg },
            ]}
          >
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <ThemedText
                style={[styles.modalCancel, { color: AppColors.primary }]}
              >
                Cancel
              </ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>
              {editingMember ? "Edit Member" : "Add Member"}
            </ThemedText>
            <TouchableOpacity onPress={handleSaveMember} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <ThemedText
                  style={[styles.modalSave, { color: AppColors.primary }]}
                >
                  Save
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollViewCompat
            contentContainerStyle={styles.modalContent}
          >
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Name</ThemedText>
              <TextInput
                style={[styles.input, { color: AppColors.text }]}
                placeholder="Family member's name"
                placeholderTextColor={AppColors.secondaryText}
                value={memberName}
                onChangeText={setMemberName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Allergies</ThemedText>
              <View style={styles.chipsContainer}>
                {ALLERGY_OPTIONS.map((allergy) => (
                  <Chip
                    key={allergy}
                    label={allergy}
                    selected={selectedAllergies.includes(allergy)}
                    onPress={() => toggleAllergy(allergy)}
                    variant="allergy"
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Dietary Preferences
              </ThemedText>
              <View style={styles.chipsContainer}>
                {PREFERENCE_OPTIONS.map((preference) => (
                  <Chip
                    key={preference}
                    label={preference}
                    selected={selectedPreferences.includes(preference)}
                    onPress={() => togglePreference(preference)}
                    variant="preference"
                  />
                ))}
              </View>
            </View>
          </KeyboardAwareScrollViewCompat>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.xl,
    color: AppColors.secondaryText,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
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
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  membersList: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: AppColors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
  },
  addButton: {
    backgroundColor: AppColors.primaryDark,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  modalCancel: {
    fontSize: 17,
  },
  modalSave: {
    fontSize: 17,
    fontWeight: "600",
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: AppColors.divider,
  },
  chipText: {
    fontSize: 14,
  },
  chipIcon: {
    marginLeft: Spacing.xs,
  },
  upgradeCard: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: AppColors.warning + "40",
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  upgradeText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  upgradeContent: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["3xl"],
  },
  upgradeIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  upgradeModalTitle: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  upgradeModalText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  planCard: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    width: "100%",
    marginBottom: Spacing.xl,
  },
  planName: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  planPrice: {
    fontSize: 28,
    fontWeight: "700",
    color: AppColors.primary,
    textAlign: "center",
    marginVertical: Spacing.sm,
  },
  planFeatures: {
    marginTop: Spacing.md,
  },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  planFeatureText: {
    fontSize: 15,
  },
  upgradeButton: {
    width: "100%",
    backgroundColor: AppColors.primaryDark,
  },
});
