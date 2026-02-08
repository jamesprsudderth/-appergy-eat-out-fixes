import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppColors } from "@/constants/colors";

export default function BackButton() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[styles.backButton, { top: insets.top + 10 }]}
      onPress={() => navigation.goBack()}
      activeOpacity={0.7}
    >
      <Ionicons name="arrow-back" size={28} color={AppColors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 30,
  },
});
