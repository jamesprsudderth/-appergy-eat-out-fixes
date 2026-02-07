import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import ScanStackNavigator from "@/navigation/ScanStackNavigator";
import HistoryStackNavigator from "@/navigation/HistoryStackNavigator";
import RestaurantStackNavigator from "@/navigation/RestaurantStackNavigator";
import RecipeStackNavigator from "@/navigation/RecipeStackNavigator";
import AccountStackNavigator from "@/navigation/AccountStackNavigator";
import { AppColors } from "@/constants/colors";

export type MainTabParamList = {
  HomeTab: undefined;
  ScanTab: undefined;
  HistoryTab: undefined;
  RestaurantsTab: undefined;
  RecipesTab: undefined;
  AccountTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.buttonText,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: AppColors.tabBar,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanStackNavigator}
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={[
                styles.scanButtonContainer,
                focused && styles.scanButtonActive,
              ]}
            >
              <Ionicons
                name={focused ? "camera" : "camera-outline"}
                size={size + 4}
                color={focused ? AppColors.text : color}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          title: "History",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="RestaurantsTab"
        component={RestaurantStackNavigator}
        options={{
          title: "Eat Out",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "restaurant" : "restaurant-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="RecipesTab"
        component={RecipeStackNavigator}
        options={{
          title: "Recipes",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "book" : "book-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountStackNavigator}
        options={{
          title: "Account",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scanButtonContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: AppColors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  scanButtonActive: {
    backgroundColor: AppColors.primary,
  },
});
