import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, getDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AppColors } from "@/constants/colors";
import { Spacing } from "@/constants/theme";
import { ScanStackParamList } from "@/navigation/ScanStackNavigator";
import { groceryService, GroceryProduct } from "@/services/grocery";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured } from "@/services/firebase";

type GroceryScanScreenNavigationProp = NativeStackNavigationProp<
  ScanStackParamList,
  "GroceryScan"
>;

interface UserProfile {
  allergies: string[];
  preferences: string[];
  forbiddenKeywords: string[];
}

export default function GroceryScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<GroceryScanScreenNavigationProp>();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedProduct, setScannedProduct] = useState<GroceryProduct | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    allergies: [],
    preferences: [],
    forbiddenKeywords: [],
  });

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    const defaultProfile: UserProfile = {
      allergies: ["Dairy", "Gluten"],
      preferences: ["Vegetarian"],
      forbiddenKeywords: [],
    };

    if (!user || !isFirebaseConfigured || !db) {
      setUserProfile(defaultProfile);
      return;
    }

    try {
      let forbiddenKeywords: string[] = [];
      const keywordsRef = doc(
        db,
        "users",
        user.uid,
        "settings",
        "forbiddenKeywords",
      );
      const keywordsSnap = await getDoc(keywordsRef);
      if (keywordsSnap.exists()) {
        forbiddenKeywords = keywordsSnap.data().keywords || [];
      }

      const mainProfileRef = doc(db, "users", user.uid);
      const mainProfileSnap = await getDoc(mainProfileRef);
      if (mainProfileSnap.exists()) {
        const data = mainProfileSnap.data().mainProfile || {};
        const allergiesData = data.allergies;
        const preferencesData = data.preferences;

        const allergies = Array.isArray(allergiesData)
          ? allergiesData
          : [
              ...(allergiesData?.common || []),
              ...(allergiesData?.custom || []),
            ];
        const preferences = Array.isArray(preferencesData)
          ? preferencesData
          : [
              ...(preferencesData?.common || []),
              ...(preferencesData?.custom || []),
            ];

        setUserProfile({
          allergies,
          preferences,
          forbiddenKeywords,
        });
      } else {
        setUserProfile({
          ...defaultProfile,
          forbiddenKeywords,
        });
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setUserProfile(defaultProfile);
    }
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (isProcessing) return;

    const upc = result.data;
    setIsProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const product = await groceryService.getProductByUPC(upc);

      if (!product) {
        Alert.alert(
          "Product Not Found",
          `Barcode ${upc} was not found in our database. Try scanning the ingredients label with the main scanner instead.`,
          [
            {
              text: "OK",
              onPress: () => setIsProcessing(false),
            },
          ],
        );
        return;
      }

      setScannedProduct(product);

      const safety = await groceryService.checkProductSafety(
        product,
        userProfile.allergies,
        userProfile.preferences,
        userProfile.forbiddenKeywords,
      );

      const analysisResult = groceryService.toAnalysisResult(product, safety);

      navigation.navigate("Results", {
        analysisResult,
      });
    } catch (error) {
      console.error("Grocery scan error:", error);
      Alert.alert(
        "Scan Error",
        "Failed to process the barcode. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsProcessing(false);
      setScannedProduct(null);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  if (!permission) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: AppColors.background },
        ]}
      >
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;

    return (
      <View
        style={[
          styles.container,
          styles.permissionContainer,
          {
            backgroundColor: AppColors.background,
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.permissionContent}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: AppColors.primary + "20" },
            ]}
          >
            <Feather name="camera" size={48} color={AppColors.primary} />
          </View>
          <ThemedText style={styles.title}>Camera Access Required</ThemedText>
          <ThemedText
            style={[styles.description, { color: AppColors.secondaryText }]}
          >
            We need camera access to scan grocery product barcodes for allergen
            checking.
          </ThemedText>
          {canAskAgain ? (
            <Button onPress={requestPermission} style={styles.permissionButton}>
              Enable Camera
            </Button>
          ) : (
            <>
              <ThemedText
                style={[styles.deniedText, { color: AppColors.secondaryText }]}
              >
                Camera permission was denied. Please enable it in Settings.
              </ThemedText>
              {Platform.OS !== "web" ? (
                <Button
                  onPress={async () => {
                    try {
                      await Linking.openSettings();
                    } catch {
                      Alert.alert("Error", "Could not open settings.");
                    }
                  }}
                  style={styles.permissionButton}
                >
                  Open Settings
                </Button>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "code128"],
        }}
        onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
      >
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Scan Grocery</ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.scanArea}>
            <View style={styles.scanFrame} />
            <ThemedText
              style={[styles.scanHint, { color: "rgba(255,255,255,0.9)" }]}
            >
              Point your camera at a product barcode
            </ThemedText>
          </View>

          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <ThemedText
                style={[
                  styles.processingText,
                  { color: "rgba(255,255,255,0.9)" },
                ]}
              >
                Looking up product...
              </ThemedText>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  headerSpacer: {
    width: 40,
  },
  scanArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 280,
    height: 120,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  scanHint: {
    fontSize: 14,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  processingText: {
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  permissionContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  deniedText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    marginTop: Spacing.md,
  },
});
