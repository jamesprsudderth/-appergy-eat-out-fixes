import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
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

type FamilyManagementNavigationProp = NativeStackNavigationProp<any>;

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
  "Corn",
  "Mustard",
  "Lupin",
  "Gelatin",
  "Sulfites",
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
  "Pescatarian",
  "Low-FODMAP",
];

interface FamilyMember {
  id: string;
  name: string;
  allergies: string[];
  preferences: string[];
  customAllergies: string[];
  customPreferences: string[];
}

function Chip({
  label,
  selected,
  onPress,
  variant = "allergy",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  variant?: "allergy" | "preference";
}) {
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
          style={{ marginLeft: 4 }}
        />
      ) : null}
    </TouchableOpacity>
  );
}

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const allergyCount = member.allergies.length + member.customAllergies.length;
  const prefCount = member.preferences.length + member.customPreferences.length;

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
            {allergyCount} allergies, {prefCount} preferences
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

export default function FamilyManagementScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<FamilyManagementNavigationProp>();
  const { user, isDemoMode } = useAuth();

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberName, setMemberName] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState("");
  const [customPreference, setCustomPreference] = useState("");
  const [customAllergies, setCustomAllergies] = useState<string[]>([]);
  const [customPreferences, setCustomPreferences] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadFamilyMembers();
  }, [user]);

  const loadFamilyMembers = async () => {
    if (isDemoMode) {
      setFamilyMembers([
        {
          id: "member1",
          name: "Demo Child",
          allergies: ["Peanuts", "Dairy"],
          preferences: ["Vegetarian"],
          customAllergies: [],
          customPreferences: [],
        },
      ]);
      setIsLoading(false);
      return;
    }

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
            customAllergies: data.customAllergies || [],
            customPreferences: data.customPreferences || [],
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

  const openAddModal = () => {
    if (familyMembers.length >= MAX_FAMILY_MEMBERS) {
      Alert.alert(
        "Limit Reached",
        `You can add up to ${MAX_FAMILY_MEMBERS} family members.`,
      );
      return;
    }
    setEditingMember(null);
    setMemberName("");
    setSelectedAllergies([]);
    setSelectedPreferences([]);
    setCustomAllergies([]);
    setCustomPreferences([]);
    setCustomAllergy("");
    setCustomPreference("");
    setModalVisible(true);
  };

  const openEditModal = (member: FamilyMember) => {
    setEditingMember(member);
    setMemberName(member.name);
    setSelectedAllergies(member.allergies);
    setSelectedPreferences(member.preferences);
    setCustomAllergies(member.customAllergies);
    setCustomPreferences(member.customPreferences);
    setCustomAllergy("");
    setCustomPreference("");
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

  const addCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (trimmed && !customAllergies.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCustomAllergies((prev) => [...prev, trimmed]);
      setCustomAllergy("");
    }
  };

  const removeCustomAllergy = (allergy: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomAllergies((prev) => prev.filter((a) => a !== allergy));
  };

  const addCustomPreference = () => {
    const trimmed = customPreference.trim();
    if (trimmed && !customPreferences.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCustomPreferences((prev) => [...prev, trimmed]);
      setCustomPreference("");
    }
  };

  const removeCustomPreference = (pref: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomPreferences((prev) => prev.filter((p) => p !== pref));
  };

  const handleSaveMember = async () => {
    if (!memberName.trim()) {
      Alert.alert("Error", "Please enter a name for this family member.");
      return;
    }

    setIsSaving(true);

    if (isDemoMode) {
      const newMember: FamilyMember = {
        id: editingMember?.id || `member${familyMembers.length + 1}`,
        name: memberName.trim(),
        allergies: selectedAllergies,
        preferences: selectedPreferences,
        customAllergies,
        customPreferences,
      };

      if (editingMember) {
        setFamilyMembers((prev) =>
          prev.map((m) => (m.id === editingMember.id ? newMember : m)),
        );
      } else {
        setFamilyMembers((prev) => [...prev, newMember]);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setIsSaving(false);
      return;
    }

    if (!isFirebaseConfigured || !db || !user) {
      Alert.alert(
        "Error",
        "Firebase is not configured or you are not logged in.",
      );
      setIsSaving(false);
      return;
    }

    try {
      const memberId = editingMember?.id || `member${familyMembers.length + 1}`;
      const docRef = doc(db, "users", user.uid, "familyProfiles", memberId);
      await setDoc(docRef, {
        name: memberName.trim(),
        allergies: selectedAllergies,
        preferences: selectedPreferences,
        customAllergies,
        customPreferences,
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
            if (isDemoMode) {
              setFamilyMembers((prev) =>
                prev.filter((m) => m.id !== member.id),
              );
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              return;
            }

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

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("AllergySetup");
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: AppColors.background },
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
          paddingTop: insets.top + Spacing["3xl"],
          paddingBottom: insets.bottom + Spacing["4xl"],
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.headerIcon,
              { backgroundColor: AppColors.primary + "20" },
            ]}
          >
            <Feather name="users" size={40} color={AppColors.primary} />
          </View>
          <ThemedText style={styles.title}>Set Up Your Family</ThemedText>
          <View style={styles.memberCountBadge}>
            <ThemedText style={styles.memberCountText}>
              {familyMembers.length}/{MAX_FAMILY_MEMBERS} members added
            </ThemedText>
          </View>
          <ThemedText
            style={[styles.subtitle, { color: AppColors.secondaryText }]}
          >
            Add family members to track their allergies when scanning. You can
            add up to {MAX_FAMILY_MEMBERS} members.
          </ThemedText>
        </View>

        {familyMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText
              style={[styles.emptyText, { color: AppColors.secondaryText }]}
            >
              No family members added yet. Tap the button below to add your
              first family member.
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
          <TouchableOpacity
            style={styles.addButton}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Feather name="plus-circle" size={24} color={AppColors.primary} />
            <ThemedText
              style={[styles.addButtonText, { color: AppColors.primary }]}
            >
              Add Family Member
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={styles.limitReached}>
            <Feather name="check-circle" size={20} color={AppColors.success} />
            <ThemedText
              style={[styles.limitText, { color: AppColors.secondaryText }]}
            >
              Maximum {MAX_FAMILY_MEMBERS} family members added
            </ThemedText>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <Button onPress={handleContinue} style={styles.continueButton}>
          Continue to My Profile Setup
        </Button>
      </View>

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
              {editingMember ? "Edit Member" : "Add Family Member"}
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

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
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

              <View style={styles.customInputRow}>
                <TextInput
                  style={[styles.customInput, { color: AppColors.text }]}
                  placeholder="Add custom allergy..."
                  placeholderTextColor={AppColors.secondaryText}
                  value={customAllergy}
                  onChangeText={setCustomAllergy}
                  onSubmitEditing={addCustomAllergy}
                />
                <TouchableOpacity
                  style={[
                    styles.addCustomButton,
                    { opacity: customAllergy.trim() ? 1 : 0.5 },
                  ]}
                  onPress={addCustomAllergy}
                  disabled={!customAllergy.trim()}
                >
                  <ThemedText style={styles.addCustomText}>Add</ThemedText>
                </TouchableOpacity>
              </View>

              {customAllergies.length > 0 ? (
                <View style={styles.customChipsContainer}>
                  {customAllergies.map((allergy) => (
                    <TouchableOpacity
                      key={allergy}
                      style={[
                        styles.customChip,
                        { backgroundColor: AppColors.destructive },
                      ]}
                      onPress={() => removeCustomAllergy(allergy)}
                    >
                      <ThemedText style={styles.customChipText}>
                        {allergy}
                      </ThemedText>
                      <Feather name="x" size={14} color={AppColors.text} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
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

              <View style={styles.customInputRow}>
                <TextInput
                  style={[styles.customInput, { color: AppColors.text }]}
                  placeholder="Add custom preference..."
                  placeholderTextColor={AppColors.secondaryText}
                  value={customPreference}
                  onChangeText={setCustomPreference}
                  onSubmitEditing={addCustomPreference}
                />
                <TouchableOpacity
                  style={[
                    styles.addCustomButton,
                    { opacity: customPreference.trim() ? 1 : 0.5 },
                  ]}
                  onPress={addCustomPreference}
                  disabled={!customPreference.trim()}
                >
                  <ThemedText style={styles.addCustomText}>Add</ThemedText>
                </TouchableOpacity>
              </View>

              {customPreferences.length > 0 ? (
                <View style={styles.customChipsContainer}>
                  {customPreferences.map((pref) => (
                    <TouchableOpacity
                      key={pref}
                      style={[
                        styles.customChip,
                        { backgroundColor: AppColors.primaryDark },
                      ]}
                      onPress={() => removeCustomPreference(pref)}
                    >
                      <ThemedText style={styles.customChipText}>
                        {pref}
                      </ThemedText>
                      <Feather name="x" size={14} color={AppColors.text} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
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
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyState: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
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
    borderRadius: BorderRadius.md,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderWidth: 2,
    borderColor: AppColors.primary,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberCountBadge: {
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  memberCountText: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.primary,
  },
  limitReached: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  limitText: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: AppColors.divider,
    backgroundColor: AppColors.background,
  },
  continueButton: {
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
  modalScroll: {
    flex: 1,
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
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  customInput: {
    flex: 1,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  addCustomButton: {
    backgroundColor: AppColors.primaryDark,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  addCustomText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  customChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  customChipText: {
    fontSize: 13,
    color: AppColors.text,
  },
});
