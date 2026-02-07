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
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import BackButton from "@/components/BackButton";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { db } from "@/services/firebase";
import { useAuth } from "@/contexts/AuthContext";

const COMMON_ALLERGIES = [
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

export default function AllergySetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, isDemoMode, refreshUserProfile } = useAuth();
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [noAllergies, setNoAllergies] = useState(false);
  const [otherAllergies, setOtherAllergies] = useState<string[]>([]);
  const [otherInput, setOtherInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleAllergy = (allergy: string) => {
    if (noAllergies) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((a) => a !== allergy)
        : [...prev, allergy],
    );
  };

  const toggleNoAllergies = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNoAllergies((prev) => {
      if (!prev) {
        setSelectedAllergies([]);
        setOtherAllergies([]);
      }
      return !prev;
    });
  };

  const addOtherAllergy = () => {
    const trimmed = otherInput.trim();
    if (trimmed && !otherAllergies.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setOtherAllergies((prev) => [...prev, trimmed]);
      setOtherInput("");
      if (noAllergies) setNoAllergies(false);
    }
  };

  const removeOther = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOtherAllergies((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid =
    noAllergies || selectedAllergies.length > 0 || otherAllergies.length > 0;

  const handleNext = async () => {
    if (!isValid) return;

    if (isDemoMode) {
      navigation.navigate("DietaryPreferencesSetup");
      return;
    }

    if (!user || !db) {
      Alert.alert("Error", "Unable to save. Please try again.");
      return;
    }

    setIsSaving(true);

    console.log("=== STARTING SAVE ALLERGIES ===");
    console.log("User ID:", user.uid);
    console.log("Selected common:", selectedAllergies);
    console.log("No allergies:", noAllergies);
    console.log("Custom allergies:", otherAllergies);

    try {
      const allergiesData = {
        common: selectedAllergies,
        none: noAllergies,
        custom: otherAllergies,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(
        doc(db, "users", user.uid),
        { mainProfile: { allergies: allergiesData } },
        { merge: true },
      );

      console.log("✅ Allergies saved successfully!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh user profile to update context with new data
      await refreshUserProfile();
      navigation.navigate("DietaryPreferencesSetup");
    } catch (error: any) {
      console.error("❌ Save failed:", error.code, error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Save Failed",
        error.message || "Failed to save allergies. Please try again.",
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
          What foods are you allergic to?
        </ThemedText>
        <TouchableOpacity
          style={styles.optionRow}
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
              styles.optionText,
              noAllergies && { color: AppColors.primary },
            ]}
          >
            No allergies / None
          </ThemedText>
        </TouchableOpacity>
        {!noAllergies ? (
          <>
            <ThemedText style={styles.sectionTitle}>
              Common Allergies
            </ThemedText>
            {COMMON_ALLERGIES.map((allergy) => (
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
        <ThemedText style={styles.sectionTitle}>Other Allergies</ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { color: AppColors.text }]}
            placeholder="Type another allergy (e.g. kiwi)"
            placeholderTextColor={AppColors.secondaryText}
            value={otherInput}
            onChangeText={setOtherInput}
            onSubmitEditing={addOtherAllergy}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: AppColors.primaryDark }]}
            onPress={addOtherAllergy}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.addButtonText}>Add</ThemedText>
          </TouchableOpacity>
        </View>
        {otherAllergies.length > 0 ? (
          <View style={styles.chipsContainer}>
            {otherAllergies.map((item, index) => (
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
            styles.nextButton,
            { backgroundColor: AppColors.primaryDark },
            !isValid && { opacity: 0.5 },
          ]}
          disabled={!isValid || isSaving}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={AppColors.text} />
          ) : (
            <ThemedText style={styles.nextButtonText}>Next</ThemedText>
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
  nextButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  nextButtonText: {
    color: AppColors.text,
    fontSize: 18,
    fontWeight: "bold",
  },
});
