import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AccountScreen from "@/screens/AccountScreen";
import ProfileEditScreen from "@/screens/ProfileEditScreen";
import FamilyProfilesScreen from "@/screens/FamilyProfilesScreen";
import KeywordManagerScreen from "@/screens/KeywordManagerScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import RecipesHistoryScreen from "@/screens/RecipesHistoryScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { AppColors } from "@/constants/colors";

export type AccountStackParamList = {
  Account: undefined;
  ProfileEdit: undefined;
  FamilyProfiles: undefined;
  KeywordManager: undefined;
  TermsOfService: undefined;
  RecipesHistory: undefined;
};

const Stack = createNativeStackNavigator<AccountStackParamList>();

export default function AccountStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator
      screenOptions={{
        ...screenOptions,
        headerBackVisible: true,
        headerTintColor: AppColors.primary,
      }}
    >
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: "Account",
        }}
      />
      <Stack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          title: "Edit Profile",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <Stack.Screen
        name="FamilyProfiles"
        component={FamilyProfilesScreen}
        options={{
          title: "Family Members",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <Stack.Screen
        name="KeywordManager"
        component={KeywordManagerScreen}
        options={{
          title: "Forbidden Keywords",
          headerLeft: () => <HeaderBackButton />,
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
        name="RecipesHistory"
        component={RecipesHistoryScreen}
        options={{
          title: "My Saved Recipes",
          headerLeft: () => <HeaderBackButton />,
        }}
      />
    </Stack.Navigator>
  );
}
