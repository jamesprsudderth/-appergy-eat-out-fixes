import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ScanScreen from "@/screens/ScanScreen";
import GroceryScanScreen from "@/screens/GroceryScanScreen";
import ResultsScreen from "@/screens/ResultsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { AppColors } from "@/constants/colors";
import { AnalysisResult } from "@/services/ai";

export type ScanStackParamList = {
  Scan: undefined;
  GroceryScan: undefined;
  Results: { analysisResult: AnalysisResult };
};

const Stack = createNativeStackNavigator<ScanStackParamList>();

export default function ScanStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator
      screenOptions={{
        ...screenOptions,
        headerShown: false,
        headerTintColor: AppColors.primary,
      }}
    >
      <Stack.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          title: "Scan",
        }}
      />
      <Stack.Screen
        name="GroceryScan"
        component={GroceryScanScreen}
        options={{
          title: "Scan Grocery",
        }}
      />
      <Stack.Screen
        name="Results"
        component={ResultsScreen}
        options={{
          title: "Analysis Results",
          headerShown: true,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
    </Stack.Navigator>
  );
}
