import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RestaurantSearchScreen from "@/screens/RestaurantSearchScreen";
import NearbyRestaurantsScreen from "@/screens/NearbyRestaurantsScreen";
import MenuScanScreen from "@/screens/MenuScanScreen";
import MenuResultsScreen from "@/screens/MenuResultsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { AppColors } from "@/constants/colors";
import { MenuItemResult } from "@/services/ai";

export type RestaurantStackParamList = {
  RestaurantSearch: undefined;
  NearbyRestaurants: undefined;
  MenuScan: { restaurantName?: string };
  MenuResults: { menuItems: MenuItemResult[]; restaurantName: string };
};

const Stack = createNativeStackNavigator<RestaurantStackParamList>();

export default function RestaurantStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator
      initialRouteName="NearbyRestaurants"
      screenOptions={{
        ...screenOptions,
        headerBackVisible: true,
        headerTintColor: AppColors.primary,
      }}
    >
      <Stack.Screen
        name="NearbyRestaurants"
        component={NearbyRestaurantsScreen}
        options={{
          title: "Eat Out",
        }}
      />
      <Stack.Screen
        name="RestaurantSearch"
        component={RestaurantSearchScreen}
        options={{
          title: "Browse Restaurants",
        }}
      />
      <Stack.Screen
        name="MenuScan"
        component={MenuScanScreen}
        options={{
          title: "Scan Menu",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MenuResults"
        component={MenuResultsScreen}
        options={{
          title: "Menu Results",
        }}
      />
    </Stack.Navigator>
  );
}
