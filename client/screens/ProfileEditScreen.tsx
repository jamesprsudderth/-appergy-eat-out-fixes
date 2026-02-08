import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth, type UserProfile } from "@/contexts/AuthContext";

/*
 * Firestore Data Model (structured format):
 *
 * Collection: users/{uid}
 * Document fields:
 *   mainProfile: {
 *     name: string,
 *     allergies: { common: string[], custom: string[], none: boolean },
 *     preferences: { common: string[], custom: string[], none: boolean },
 *     updatedAt: timestamp
 *   }
 *
 * Subcollection: users/{uid}/settings/forbiddenKeywords
 *   { keywords: string[] }
 */

const ALLERGY_OPTIONS = [
  "Milk",
  "Eggs",
  "Peanuts",
  "Tree nuts",
  "Fish",
  "Shellfish",
  "Wheat",
  "Soy",
  "Sesame",
  "Corn",
  "Mustard",
  "Lupin",
  "Gelatin",
  "Sulfites",
  "Seeds",
];

const PREFERENCE_OPTIONS = [
  "Vegan",
  "Vegetarian",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
  "Keto / Low-carb",
  "Low-sodium",
  "Pescatarian",
  "Paleo",
  "Low-FODMAP",
  "Halal",
  "Kosher",
];

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { userProfile, updateUserProfile } = useAuth();

  // ─── Form State ───
  const [name, setName] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergies, setCustomAllergies] = useState<string[]>([]);
  const [noAllergies, setNoAllergies] = useState(false);
  const [otherAllergyInput, setOtherAllergyInput] = useState("");

  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [customPreferences, setCustomPreferences] = useState<string[]>([]);
  const [noPreferences, setNoPreferences] = useState(false);
  const [otherPrefInput, setOtherPrefInput] = useState("");

  const [forbiddenKeywords, setForbiddenKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // ─── Load from AuthContext ───
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || "");

      // Handle both structured and flat formats for backward compat
      const allergies = userProfile.allergies;
      if (allergies) {
        if (Array.isArray(allergies)) {
          // Old flat format: allergies: string[]
          setSelectedAllergies(allergies as unknown as string[]);
          setCustomAllergies([]);
          setNoAllergies(false);
        } else {
          // New structured format
          setSelectedAllergies(allergies.common || []);
          setCustomAllergies(allergies.custom || []);
          setNoAllergies(allergies.none || false);
        }
      }

      const preferences = userProfile.preferences;
      if (preferences) {
        if (Array.isArray(preferences)) {
          setSelectedPreferences(preferences as unknown as string[]);
          setCustomPreferences([]);
          setNoPreferences(false);
        } else {
          setSelectedPreferences(preferences.common || []);
          setCustomPreferences(preferences.custom || []);
          setNoPreferences(preferences.none || false);
        }
      }

      setForbiddenKeywords(userProfile.forbiddenKeywords || []);
    }
  }, [userProfile]);

  // ─── Allergy Handlers ───
  const toggleNoAllergies = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNoAllergies((prev) => {
      if (!prev) {
        setSelectedAllergies([]);
        setCustomAllergies([]);
      }
      return !prev;
    });
  };

  const toggleAllergy = (allergy: string) => {
    if (noAllergies) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((a) => a !== allergy)
        : [...prev, allergy],
    );
  };

  const addCustomAllergy = () => {
    const trimmed = otherAllergyInput.trim();
    if (trimmed && !customAllergies.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCustomAllergies((prev) => [...prev, trimmed]);
      setOtherAllergyInput("");
      if (noAllergies) setNoAllergies(false);
    }
  };

  const removeCustomAllergy = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomAllergies((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Preference Handlers ───
  const toggleNoPreferences = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNoPreferences((prev) => {
      if (!prev) {
        setSelectedPreferences([]);
        setCustomPreferences([]);
      }
      return !prev;
    });
  };

  const togglePreference = (preference: string) => {
    if (noPreferences) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPreferences((prev) =>
      prev.includes(preference)
        ? prev.filter((p) => p !== preference)
        : [...prev, preference],
    );
  };

  const addCustomPreference = () => {
    const trimmed = otherPrefInput.trim();
    if (trimmed && !customPreferences.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCustomPreferences((prev) => [...prev, trimmed]);
      setOtherPrefInput("");
      if (noPreferences) setNoPreferences(false);
    }
  };

  const removeCustomPreference = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomPreferences((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Forbidden Keyword Handlers ───
  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (
      trimmed &&
      !forbiddenKeywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())
    ) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setForbiddenKeywords((prev) => [...prev, trimmed]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForbiddenKeywords((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Save ───
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedProfile: UserProfile = {
        name: name.trim(),
        allergies: {
          common: selectedAllergies,
          custom: customAllergies,
          none: noAllergies,
        },
        preferences: {
          common: selectedPreferences,
          custom: customPreferences,
          none: noPreferences,
        },
        forbiddenKeywords,
      };

      await updateUserProfile(updatedProfile);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ───
  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: AppColors.background }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing["4xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* ── Name ── */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Your Name</ThemedText>
        <TextInput
          style={[styles.input, { color: AppColors.text }]}
          placeholder="Enter your name"
          placeholderTextColor={AppColors.secondaryText}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          testID="input-name"
        />
      </View>

      {/* ── Allergies ── */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Allergies</ThemedText>
        <ThemedText
          style={[styles.sectionSubtitle, { color: AppColors.secondaryText }]}
        >
          Select all that apply or choose &quot;No allergies&quot;
        </ThemedText>

        <TouchableOpacity
          style={styles.toggleRow}
          onPress={toggleNoAllergies}
          activeOpacity={0.7}
        >
          <Ionicons
            name={noAllergies ? "checkmark-circle" : "ellipse-outline"}
            size={28}
            color={noAllergies ? AppColors.primary : AppColors.secondaryText}
          />
          <ThemedText
            style={[
              styles.toggleText,
              noAllergies && { color: AppColors.primary },
            ]}
          >
            No allergies / None
          </ThemedText>
        </TouchableOpacity>

        {!noAllergies ? (
          <>
            <ThemedText
              style={[styles.subsectionTitle, { color: AppColors.primary }]}
            >
              Common Allergens
            </ThemedText>
            {ALLERGY_OPTIONS.map((allergy) => (
              <TouchableOpacity
                key={allergy}
                style={styles.optionRow}
                onPress={() => toggleAllergy(allergy)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    selectedAllergies.includes(allergy)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={24}
                  color={
                    selectedAllergies.includes(allergy)
                      ? AppColors.primary
                      : AppColors.secondaryText
                  }
                />
                <ThemedText style={styles.optionText}>{allergy}</ThemedText>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        <ThemedText
          style={[
            styles.subsectionTitle,
            { color: AppColors.primary, marginTop: Spacing.lg },
          ]}
        >
          Other Allergies
        </ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.rowInput, { color: AppColors.text }]}
            placeholder="Type another allergy"
            placeholderTextColor={AppColors.secondaryText}
            value={otherAllergyInput}
            onChangeText={setOtherAllergyInput}
            onSubmitEditing={addCustomAllergy}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: AppColors.primaryDark },
            ]}
            onPress={addCustomAllergy}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.addButtonText}>Add</ThemedText>
          </TouchableOpacity>
        </View>

        {customAllergies.length > 0 ? (
          <View style={styles.chipsRow}>
            {customAllergies.map((item, index) => (
              <View key={index} style={styles.chip}>
                <ThemedText style={styles.chipText}>{item}</ThemedText>
                <TouchableOpacity onPress={() => removeCustomAllergy(index)}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={AppColors.destructive}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── Dietary Preferences ── */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Dietary Preferences</ThemedText>
        <ThemedText
          style={[styles.sectionSubtitle, { color: AppColors.secondaryText }]}
        >
          Select all that apply or choose &quot;No preferences&quot;
        </ThemedText>

        <TouchableOpacity
          style={styles.toggleRow}
          onPress={toggleNoPreferences}
          activeOpacity={0.7}
        >
          <Ionicons
            name={noPreferences ? "checkmark-circle" : "ellipse-outline"}
            size={28}
            color={noPreferences ? AppColors.primary : AppColors.secondaryText}
          />
          <ThemedText
            style={[
              styles.toggleText,
              noPreferences && { color: AppColors.primary },
            ]}
          >
            No dietary preferences
          </ThemedText>
        </TouchableOpacity>

        {!noPreferences ? (
          <>
            <ThemedText
              style={[styles.subsectionTitle, { color: AppColors.primary }]}
            >
              Common Preferences
            </ThemedText>
            {PREFERENCE_OPTIONS.map((preference) => (
              <TouchableOpacity
                key={preference}
                style={styles.optionRow}
                onPress={() => togglePreference(preference)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    selectedPreferences.includes(preference)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={24}
                  color={
                    selectedPreferences.includes(preference)
                      ? AppColors.primary
                      : AppColors.secondaryText
                  }
                />
                <ThemedText style={styles.optionText}>{preference}</ThemedText>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        <ThemedText
          style={[
            styles.subsectionTitle,
            { color: AppColors.primary, marginTop: Spacing.lg },
          ]}
        >
          Other Preferences
        </ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.rowInput, { color: AppColors.text }]}
            placeholder="Type another preference"
            placeholderTextColor={AppColors.secondaryText}
            value={otherPrefInput}
            onChangeText={setOtherPrefInput}
            onSubmitEditing={addCustomPreference}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: AppColors.primaryDark },
            ]}
            onPress={addCustomPreference}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.addButtonText}>Add</ThemedText>
          </TouchableOpacity>
        </View>

        {customPreferences.length > 0 ? (
          <View style={styles.chipsRow}>
            {customPreferences.map((item, index) => (
              <View key={index} style={styles.chip}>
                <ThemedText style={styles.chipText}>{item}</ThemedText>
                <TouchableOpacity onPress={() => removeCustomPreference(index)}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={AppColors.destructive}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── Forbidden Keywords ── */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Forbidden Keywords</ThemedText>
        <ThemedText
          style={[styles.sectionSubtitle, { color: AppColors.secondaryText }]}
        >
          Ingredients you always want flagged (e.g., MSG, Palm oil, Aspartame)
        </ThemedText>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.rowInput, { color: AppColors.text }]}
            placeholder="Type a keyword to avoid"
            placeholderTextColor={AppColors.secondaryText}
            value={keywordInput}
            onChangeText={setKeywordInput}
            onSubmitEditing={addKeyword}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: AppColors.warning }]}
            onPress={addKeyword}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.addButtonText}>Add</ThemedText>
          </TouchableOpacity>
        </View>

        {forbiddenKeywords.length > 0 ? (
          <View style={styles.chipsRow}>
            {forbiddenKeywords.map((kw, index) => (
              <View
                key={index}
                style={[styles.chip, { borderColor: AppColors.warning }]}
              >
                <Ionicons
                  name="warning"
                  size={14}
                  color={AppColors.warning}
                  style={{ marginRight: 4 }}
                />
                <ThemedText style={styles.chipText}>{kw}</ThemedText>
                <TouchableOpacity onPress={() => removeKeyword(index)}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={AppColors.destructive}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText
            style={[styles.emptyHint, { color: AppColors.secondaryText }]}
          >
            No forbidden keywords set. Add keywords for ingredients you want to
            always avoid regardless of allergy or diet.
          </ThemedText>
        )}
      </View>

      {/* ── Summary ── */}
      <View style={styles.summary}>
        <ThemedText
          style={[styles.summaryText, { color: AppColors.secondaryText }]}
        >
          {noAllergies
            ? "No allergies"
            : `${selectedAllergies.length + customAllergies.length} allergies`}
          ,{" "}
          {noPreferences
            ? "no preferences"
            : `${selectedPreferences.length + customPreferences.length} preferences`}
          , {forbiddenKeywords.length} forbidden keywords
        </ThemedText>
      </View>

      <Button
        onPress={handleSave}
        disabled={isSaving}
        style={styles.saveButton}
      >
        {isSaving ? (
          <ActivityIndicator color={AppColors.text} />
        ) : (
          "Save Profile"
        )}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    marginTop: Spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  toggleText: {
    fontSize: 18,
    marginLeft: Spacing.md,
    fontWeight: "500",
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginVertical: Spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  optionText: {
    fontSize: 16,
    marginLeft: Spacing.md,
    color: AppColors.text,
  },
  inputRow: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  rowInput: {
    flex: 1,
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    fontSize: 16,
  },
  addButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
  },
  addButtonText: {
    fontWeight: "600",
    color: AppColors.text,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: AppColors.divider,
    gap: Spacing.xs,
  },
  chipText: {
    color: AppColors.text,
    fontSize: 14,
  },
  summary: {
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  summaryText: {
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: AppColors.primaryDark,
  },
  emptyHint: {
    fontSize: 13,
    fontStyle: "italic",
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
});
