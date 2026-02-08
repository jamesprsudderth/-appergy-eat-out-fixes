import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import AllergySetupScreen from "@/screens/AllergySetupScreen";
import DietaryPreferencesSetupScreen from "@/screens/DietaryPreferencesSetupScreen";
import RoleSelectionScreen from "@/screens/RoleSelectionScreen";
import FamilyManagementScreen from "@/screens/FamilyManagementScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { AppColors } from "@/constants/colors";

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  Onboarding: undefined;
  TermsOfService: undefined;
  RoleSelection: undefined;
  FamilyManagement: undefined;
  AllergySetup: undefined;
  DietaryPreferencesSetup: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        ...screenOptions,
        headerShown: false,
        headerTintColor: AppColors.primary,
        contentStyle: {
          backgroundColor: AppColors.background,
        },
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{
          headerShown: true,
          headerTransparent: true,
          title: "",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="RoleSelection"
        component={RoleSelectionScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="FamilyManagement"
        component={FamilyManagementScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="AllergySetup"
        component={AllergySetupScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="DietaryPreferencesSetup"
        component={DietaryPreferencesSetupScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}
