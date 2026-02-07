import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import RecipeGeneratorScreen from "@/screens/RecipeGeneratorScreen";

export type RecipeStackParamList = {
  RecipeGenerator: undefined;
};

const Stack = createNativeStackNavigator<RecipeStackParamList>();

export default function RecipeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="RecipeGenerator"
        component={RecipeGeneratorScreen}
        options={{ headerTitle: "Recipes" }}
      />
    </Stack.Navigator>
  );
}
