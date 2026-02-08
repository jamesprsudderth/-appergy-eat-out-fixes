import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { doc, setDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import BackButton from "@/components/BackButton";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { db } from "@/services/firebase";
import { useAuth } from "@/contexts/AuthContext";

const COMMON_PREFERENCES = [
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

export default function DietaryPreferencesSetupScreen() {
  const insets = useSafeAreaInsets();
  const { user, isDemoMode, setIsOnboarded, refreshUserProfile } = useAuth();

  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [noPreferences, setNoPreferences] = useState(false);
  const [otherPrefs, setOtherPrefs] = useState<string[]>([]);
  const [otherInput, setOtherInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const togglePreference = (pref: string) => {
    if (noPreferences) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  };

  const toggleNoPreferences = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNoPreferences((prev) => {
      if (!prev) {
        setSelectedPrefs([]);
        setOtherPrefs([]);
      }
      return !prev;
    });
  };

  const addOtherPref = () => {
    const trimmed = otherInput.trim();
    if (trimmed && !otherPrefs.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setOtherPrefs((prev) => [...prev, trimmed]);
      setOtherInput("");
      if (noPreferences) setNoPreferences(false);
    }
  };

  const removeOther = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOtherPrefs((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid =
    noPreferences || selectedPrefs.length > 0 || otherPrefs.length > 0;

  const handleFinish = async () => {
    if (!isValid) return;

    if (isDemoMode) {
      setIsOnboarded(true);
      return;
    }

    if (!user || !db) {
      Alert.alert("Error", "Unable to save. Please try again.");
      return;
    }

    setIsSaving(true);

    console.log("=== STARTING SAVE PREFERENCES ===");
    console.log("User ID:", user.uid);
    console.log("Selected common:", selectedPrefs);
    console.log("No preferences:", noPreferences);
    console.log("Custom preferences:", otherPrefs);

    try {
      const preferencesData = {
        common: selectedPrefs,
        none: noPreferences,
        custom: otherPrefs,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(
        doc(db, "users", user.uid),
        { mainProfile: { preferences: preferencesData } },
        { merge: true },
      );

      console.log("✅ Preferences saved successfully!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh user profile to update context with new data
      await refreshUserProfile();
      setIsOnboarded(true);
    } catch (error: any) {
      console.error("❌ Save failed:", error.code, error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Save Failed",
        error.message || "Failed to save preferences. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <BackButton />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + 70,
          paddingBottom: insets.bottom + Spacing["4xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.title}>
          What are your dietary preferences?
        </ThemedText>

        <TouchableOpacity
          style={styles.optionRow}
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
              styles.optionText,
              noPreferences && { color: AppColors.primary },
            ]}
          >
            No dietary preferences
          </ThemedText>
        </TouchableOpacity>

        {!noPreferences ? (
          <>
            <ThemedText style={styles.sectionTitle}>
              Common Preferences
            </ThemedText>
            {COMMON_PREFERENCES.map((pref) => (
              <TouchableOpacity
                key={pref}
                style={styles.optionRow}
                onPress={() => togglePreference(pref)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    selectedPrefs.includes(pref)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={24}
                  color={
                    selectedPrefs.includes(pref)
                      ? AppColors.primary
                      : AppColors.secondaryText
                  }
                />
                <ThemedText style={styles.optionText}>{pref}</ThemedText>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        <ThemedText style={styles.sectionTitle}>Other Preferences</ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { color: AppColors.text }]}
            placeholder="Type another preference"
            placeholderTextColor={AppColors.secondaryText}
            value={otherInput}
            onChangeText={setOtherInput}
            onSubmitEditing={addOtherPref}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: AppColors.primaryDark }]}
            onPress={addOtherPref}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.addButtonText}>Add</ThemedText>
          </TouchableOpacity>
        </View>

        {otherPrefs.length > 0 ? (
          <View style={styles.chipsContainer}>
            {otherPrefs.map((item, index) => (
              <View key={index} style={styles.chip}>
                <ThemedText style={styles.chipText}>{item}</ThemedText>
                <TouchableOpacity onPress={() => removeOther(index)}>
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

        <TouchableOpacity
          style={[
            styles.finishButton,
            { backgroundColor: AppColors.primaryDark },
            !isValid && { opacity: 0.5 },
          ]}
          disabled={!isValid || isSaving}
          onPress={handleFinish}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={AppColors.text} />
          ) : (
            <ThemedText style={styles.finishButtonText}>
              Finish Setup
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 20,
    color: AppColors.primary,
    marginVertical: Spacing.md,
    fontWeight: "600",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  optionText: {
    color: AppColors.text,
    fontSize: 18,
    marginLeft: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: AppColors.surface,
    padding: Spacing.md,
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
    color: AppColors.text,
    fontWeight: "bold",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  chipText: {
    color: AppColors.text,
  },
  finishButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  finishButtonText: {
    color: AppColors.text,
    fontSize: 18,
    fontWeight: "bold",
  },
});
