import React, { useState, useRef, useEffect } from "react";
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
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, getDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RestaurantStackParamList } from "@/navigation/RestaurantStackNavigator";
import { analyzeMenu } from "@/services/ai";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured } from "@/services/firebase";

type MenuScanScreenNavigationProp = NativeStackNavigationProp<
  RestaurantStackParamList,
  "MenuScan"
>;
type MenuScanScreenRouteProp = RouteProp<RestaurantStackParamList, "MenuScan">;

interface CapturedImage {
  uri: string;
  base64: string;
}

interface UserProfile {
  allergies: string[];
  customAllergies: string[];
  preferences: string[];
  forbiddenKeywords: string[];
}

export default function MenuScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MenuScanScreenNavigationProp>();
  const route = useRoute<MenuScanScreenRouteProp>();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(
    null,
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    allergies: [],
    customAllergies: [],
    preferences: [],
    forbiddenKeywords: [],
  });
  const cameraRef = useRef<CameraView>(null);

  const restaurantName = route.params?.restaurantName || "Restaurant";

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user || !isFirebaseConfigured || !db) {
      // Demo mode - use demo profile data
      setUserProfile({
        allergies: ["Dairy", "Peanuts"],
        customAllergies: [],
        preferences: ["Vegetarian"],
        forbiddenKeywords: ["MSG", "Artificial colors"],
      });
      return;
    }

    try {
      // Load forbidden keywords
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

      // Load main profile from Firestore
      const profileRef = doc(db, "users", user.uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const data = profileSnap.data().mainProfile || {};

        // Extract allergies from structured format
        const allergiesData = data.allergies || {};
        const commonAllergies = allergiesData.common || [];
        const customAllergies = allergiesData.custom || [];

        // Extract preferences from structured format
        const preferencesData = data.preferences || {};
        const commonPreferences = preferencesData.common || [];
        const customPreferences = preferencesData.custom || [];

        setUserProfile({
          allergies: commonAllergies,
          customAllergies: customAllergies,
          preferences: [...commonPreferences, ...customPreferences],
          forbiddenKeywords,
        });

        console.log("MenuScan: Loaded profile with", {
          allergies: commonAllergies.length + customAllergies.length,
          preferences: commonPreferences.length + customPreferences.length,
        });
      } else {
        // User exists but no profile - use empty
        setUserProfile({
          allergies: [],
          customAllergies: [],
          preferences: [],
          forbiddenKeywords,
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      // Fallback to empty profile
      setUserProfile({
        allergies: [],
        customAllergies: [],
        preferences: [],
        forbiddenKeywords: [],
      });
    }
  };

  if (!permission) {
    return (
      <View
        style={[styles.container, { backgroundColor: AppColors.background }]}
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
            We need camera access to scan restaurant menus for allergen
            information.
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

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (photo && photo.uri) {
        const manipulated = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );

        if (manipulated.base64) {
          setCapturedImage({
            uri: manipulated.uri,
            base64: manipulated.base64,
          });
          setIsAnalyzing(true);

          try {
            const result = await analyzeMenu(manipulated.base64, userProfile);
            setIsAnalyzing(false);
            setCapturedImage(null);
            navigation.navigate("MenuResults", {
              menuItems: result.menu_items,
              restaurantName,
            });
          } catch (error) {
            console.error("Menu analysis error:", error);
            setIsAnalyzing(false);
            Alert.alert("Error", "Failed to analyze menu. Please try again.");
          }
        }
      }
    } catch (error) {
      console.error("Capture error:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedImage(null);
    setIsAnalyzing(false);
  };

  const toggleFacing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  if (capturedImage) {
    return (
      <View
        style={[styles.container, { backgroundColor: AppColors.background }]}
      >
        <View
          style={[
            styles.previewHeader,
            { paddingTop: insets.top + Spacing.lg },
          ]}
        >
          <ThemedText style={styles.previewTitle}>
            {isAnalyzing ? "Analyzing Menu..." : "Preview"}
          </ThemedText>
        </View>

        <View style={styles.previewContainer}>
          <Image
            source={{ uri: capturedImage.uri }}
            style={styles.previewImage}
            contentFit="contain"
          />

          {isAnalyzing ? (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color={AppColors.primary} />
              <ThemedText style={styles.analyzingText}>
                Analyzing menu items...
              </ThemedText>
              <ThemedText
                style={[
                  styles.analyzingSubtext,
                  { color: AppColors.secondaryText },
                ]}
              >
                Checking for allergens and dietary conflicts
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.previewControls,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <Button
            onPress={handleRetake}
            style={styles.retakeButton}
            disabled={isAnalyzing}
          >
            <Feather name="refresh-cw" size={20} color={AppColors.text} />
            <ThemedText style={styles.retakeButtonText}>Retake</ThemedText>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.headerButton,
                { backgroundColor: AppColors.surface + "80" },
              ]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="x" size={24} color={AppColors.text} />
            </TouchableOpacity>

            <View
              style={[
                styles.headerTitle,
                { backgroundColor: AppColors.surface + "80" },
              ]}
            >
              <Feather name="book-open" size={16} color={AppColors.primary} />
              <ThemedText style={styles.headerTitleText}>Scan Menu</ThemedText>
            </View>

            <TouchableOpacity
              style={[
                styles.headerButton,
                { backgroundColor: AppColors.surface + "80" },
              ]}
              onPress={toggleFacing}
            >
              <Feather name="refresh-cw" size={20} color={AppColors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <View style={styles.instructionContainer}>
            <ThemedText style={styles.instruction}>
              Position the menu within the frame
            </ThemedText>
            <ThemedText
              style={[
                styles.subInstruction,
                { color: AppColors.secondaryText },
              ]}
            >
              Make sure the text is clear and readable
            </ThemedText>
          </View>
        </View>
      </View>

      <View
        style={[styles.controls, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.captureRow}>
          <View style={styles.placeholderButton} />

          <TouchableOpacity
            style={[
              styles.captureButton,
              { borderColor: AppColors.primary },
              isCapturing && styles.captureButtonDisabled,
            ]}
            onPress={handleCapture}
            disabled={isCapturing}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.captureButtonInner,
                { backgroundColor: AppColors.primaryDark },
              ]}
            />
          </TouchableOpacity>

          <View style={styles.placeholderButton} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  permissionContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  deniedText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  permissionButton: {
    minWidth: 200,
  },
  cameraContainer: {
    flex: 1,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  headerTitleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scanFrame: {
    width: "85%",
    aspectRatio: 4 / 3,
    alignSelf: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: AppColors.primary,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  instructionContainer: {
    alignItems: "center",
    paddingBottom: Spacing.xl,
  },
  instruction: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subInstruction: {
    fontSize: 14,
    marginTop: Spacing.xs,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  controls: {
    paddingTop: Spacing.lg,
  },
  captureRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing["2xl"],
  },
  placeholderButton: {
    width: 44,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  previewHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: "center",
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  previewContainer: {
    flex: 1,
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    flex: 1,
    borderRadius: BorderRadius.lg,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
  },
  analyzingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: Spacing.lg,
  },
  analyzingSubtext: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  previewControls: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
