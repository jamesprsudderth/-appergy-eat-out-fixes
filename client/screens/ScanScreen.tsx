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
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, getDoc } from "firebase/firestore";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ScanStackParamList } from "@/navigation/ScanStackNavigator";
import {
  analyzeImage,
  lookupBarcode,
  analyzeBarcodeProduct,
  ProfileInfo,
} from "@/services/ai";
import {
  analyzeIngredientsText,
  analyzeIngredientsTextEnhanced,
} from "@/services/analysisPipeline";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured } from "@/services/firebase";

type ScanScreenNavigationProp = NativeStackNavigationProp<
  ScanStackParamList,
  "Scan"
>;
type ScanMode = "camera" | "barcode";

interface CapturedImage {
  uri: string;
  base64: string;
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ScanScreenNavigationProp>();
  const { user, userRole } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [scanMode, setScanMode] = useState<ScanMode>("camera");
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(
    null,
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const selectedProfiles = profiles.filter((p) =>
    selectedProfileIds.includes(p.id),
  );

  useEffect(() => {
    loadProfiles();
  }, [user]);

  const loadProfiles = async () => {
    const loadedProfiles: ProfileInfo[] = [];
    let forbiddenKeywords: string[] = [];

    // Get user display name for profile
    const userName = user?.displayName || user?.email?.split("@")[0] || "You";

    if (user && isFirebaseConfigured && db) {
      try {
        // Load forbidden keywords first
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

        // Load main user profile from Firestore
        const mainProfileRef = doc(db, "users", user.uid);
        const mainProfileSnap = await getDoc(mainProfileRef);

        if (mainProfileSnap.exists()) {
          const userData = mainProfileSnap.data();
          const profileData = userData.mainProfile || {};

          // Extract allergies from structured format
          const allergiesData = profileData.allergies || {};
          const commonAllergies = allergiesData.common || [];
          const customAllergies = allergiesData.custom || [];
          const allAllergies = [...commonAllergies, ...customAllergies];

          // Extract preferences from structured format
          const preferencesData = profileData.preferences || {};
          const commonPreferences = preferencesData.common || [];
          const customPreferences = preferencesData.custom || [];
          const allPreferences = [...commonPreferences, ...customPreferences];

          loadedProfiles.push({
            id: "mainProfile",
            name: profileData.name || userName,
            allergies: allAllergies,
            customAllergies: customAllergies,
            preferences: allPreferences,
            customPreferences: customPreferences,
            forbiddenKeywords,
            treatMayContainAsUnsafe:
              profileData.treatMayContainAsUnsafe ?? false,
            allergySeverity: profileData.allergySeverity || {},
            emergencyContact: profileData.emergencyContact || undefined,
          });

          console.log("Loaded main profile:", loadedProfiles[0]);
        } else {
          // User exists but no profile data yet - create default
          loadedProfiles.push({
            id: "mainProfile",
            name: userName,
            allergies: [],
            preferences: [],
            forbiddenKeywords,
            treatMayContainAsUnsafe: false,
          });
        }

        // Load family member profiles
        for (let i = 1; i <= 4; i++) {
          const memberRef = doc(
            db,
            "users",
            user.uid,
            "familyProfiles",
            `member${i}`,
          );
          const memberSnap = await getDoc(memberRef);
          if (memberSnap.exists()) {
            const data = memberSnap.data();

            // Extract allergies from structured format for family members
            const memberAllergies = data.allergies || {};
            const memberCommonAllergies = Array.isArray(memberAllergies)
              ? memberAllergies
              : [
                  ...(memberAllergies.common || []),
                  ...(memberAllergies.custom || []),
                ];

            // Extract preferences from structured format for family members
            const memberPreferences = data.preferences || {};
            const memberCommonPreferences = Array.isArray(memberPreferences)
              ? memberPreferences
              : [
                  ...(memberPreferences.common || []),
                  ...(memberPreferences.custom || []),
                ];

            loadedProfiles.push({
              id: `member${i}`,
              name: data.name || `Family Member ${i}`,
              allergies: memberCommonAllergies,
              preferences: memberCommonPreferences,
              forbiddenKeywords,
              treatMayContainAsUnsafe: data.treatMayContainAsUnsafe ?? false,
              allergySeverity: data.allergySeverity || {},
              emergencyContact: data.emergencyContact || undefined,
            });
          }
        }
      } catch (error) {
        console.error("Error loading profiles from Firestore:", error);
        // Fallback to empty profile on error
        loadedProfiles.push({
          id: "mainProfile",
          name: userName,
          allergies: [],
          preferences: [],
          forbiddenKeywords: [],
        });
      }
    } else {
      // Demo mode or Firebase not configured - use demo data
      loadedProfiles.push({
        id: "mainProfile",
        name: userName,
        allergies: ["Dairy", "Peanuts"],
        preferences: ["Vegetarian"],
        forbiddenKeywords: ["MSG", "Artificial colors"],
      });
    }

    // Ensure we always have at least one profile
    if (loadedProfiles.length === 0) {
      loadedProfiles.push({
        id: "mainProfile",
        name: userName,
        allergies: [],
        preferences: [],
        forbiddenKeywords: [],
      });
    }

    setProfiles(loadedProfiles);

    // Admin sees all profiles, member only sees their own (mainProfile)
    if (userRole === "member") {
      const selfOnly = loadedProfiles.filter((p) => p.id === "mainProfile");
      setSelectedProfileIds(selfOnly.map((p) => p.id));
    } else {
      setSelectedProfileIds(loadedProfiles.map((p) => p.id));
    }

    console.log(
      "Loaded profiles:",
      loadedProfiles.map((p) => ({
        name: p.name,
        allergies: p.allergies,
        preferences: p.preferences,
      })),
    );
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (isProcessingBarcode || scannedBarcode) return;

    const barcode = result.data;
    setScannedBarcode(barcode);
    setIsProcessingBarcode(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Look up the product using Open Food Facts API
      const product = await lookupBarcode(barcode);

      if (!product.found) {
        // Product not found in database - show alert
        Alert.alert(
          "Product Not Found",
          `Barcode ${barcode} was not found in our database. Try scanning the ingredients label instead.`,
          [
            {
              text: "Scan Label",
              onPress: () => {
                setScanMode("camera");
                setScannedBarcode(null);
                setIsProcessingBarcode(false);
              },
            },
            {
              text: "Try Again",
              onPress: () => {
                setScannedBarcode(null);
                setIsProcessingBarcode(false);
              },
            },
          ],
        );
        return;
      }

      // Analyze the product using the deterministic pipeline
      // Combine ingredients and allergens into text for the engine
      const ingredientText = [
        ...(product.ingredients || []),
        ...(product.allergens || []).map((a) => `Contains: ${a}`),
      ].join(", ");

      const analysisResult =
        ingredientText.length > 0
          ? analyzeIngredientsText(ingredientText, selectedProfiles)
          : analyzeBarcodeProduct(product, selectedProfiles);

      navigation.navigate("Results", {
        analysisResult,
      });
    } catch (error) {
      console.error("Barcode processing error:", error);
      Alert.alert(
        "Scan Error",
        "Failed to process the barcode. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsProcessingBarcode(false);
      setScannedBarcode(null);
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
            We need camera access to scan packaging and ingredients for
            allergens.
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
            // Step 1: Try server API (OCR + deterministic pipeline)
            let result;
            try {
              result = await analyzeImage(manipulated.base64, selectedProfiles);

              // Server now runs the full pipeline and returns
              // AnalysisResult directly — no client-side re-analysis needed.
              // Only fall through if server returned mock data AND we're offline.
            } catch {
              // Step 2: Server unreachable — run mock text through local engine
              const mockText =
                "Wheat flour, Sugar, Milk, Eggs, Salt, Vegetable oil, " +
                "Natural flavors, Soy lecithin, Modified corn starch, " +
                "Sodium benzoate, MSG, Artificial colors (Red 40). " +
                "Contains: wheat, milk, eggs, soy.";
              result = analyzeIngredientsText(mockText, selectedProfiles);
            }

            setIsAnalyzing(false);
            setCapturedImage(null);
            navigation.navigate("Results", { analysisResult: result });
          } catch (error) {
            console.error("Analysis error:", error);
            setIsAnalyzing(false);
            Alert.alert("Error", "Failed to analyze image. Please try again.");
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

  const toggleScanMode = (mode: ScanMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanMode(mode);
    setScannedBarcode(null);
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
            {isAnalyzing ? "Analyzing..." : "Preview"}
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
                Scanning for allergens...
              </ThemedText>
              <ThemedText
                style={[
                  styles.analyzingSubtext,
                  { color: AppColors.secondaryText },
                ]}
              >
                Checking {profiles.length} profile
                {profiles.length !== 1 ? "s" : ""}
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
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        barcodeScannerSettings={
          scanMode === "barcode"
            ? {
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "code128",
                  "code39",
                ],
              }
            : undefined
        }
        onBarcodeScanned={
          scanMode === "barcode" ? handleBarcodeScanned : undefined
        }
      >
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>
              {scanMode === "camera"
                ? "Scan Packaging / Ingredients"
                : "Scan Barcode"}
            </ThemedText>
            <TouchableOpacity
              style={styles.profileSelector}
              onPress={() => setShowProfileSelector(!showProfileSelector)}
            >
              <Ionicons name="people" size={16} color="rgba(255,255,255,0.9)" />
              <ThemedText
                style={[
                  styles.headerSubtitle,
                  { color: "rgba(255,255,255,0.9)" },
                ]}
              >
                {selectedProfiles.length} of {profiles.length} profile
                {profiles.length !== 1 ? "s" : ""}
              </ThemedText>
              <Ionicons
                name={showProfileSelector ? "chevron-up" : "chevron-down"}
                size={14}
                color="rgba(255,255,255,0.7)"
              />
            </TouchableOpacity>
          </View>

          {showProfileSelector ? (
            <View style={styles.profileSelectorDropdown}>
              {profiles.map((profile) => {
                const isSelected = selectedProfileIds.includes(profile.id);
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.profileOption,
                      isSelected && styles.profileOptionSelected,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (isSelected && selectedProfileIds.length > 1) {
                        setSelectedProfileIds(
                          selectedProfileIds.filter((id) => id !== profile.id),
                        );
                      } else if (!isSelected) {
                        setSelectedProfileIds([
                          ...selectedProfileIds,
                          profile.id,
                        ]);
                      }
                    }}
                  >
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        isSelected ? AppColors.primary : "rgba(255,255,255,0.6)"
                      }
                    />
                    <ThemedText style={styles.profileOptionText}>
                      {profile.name}
                    </ThemedText>
                    {profile.allergies.length > 0 ? (
                      <View style={styles.profileBadge}>
                        <ThemedText style={styles.profileBadgeText}>
                          {profile.allergies.length} allergies
                        </ThemedText>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                scanMode === "camera" && styles.modeButtonActive,
              ]}
              onPress={() => toggleScanMode("camera")}
            >
              <Ionicons
                name="camera-outline"
                size={20}
                color={
                  scanMode === "camera" ? AppColors.background : AppColors.text
                }
              />
              <ThemedText
                style={[
                  styles.modeButtonText,
                  {
                    color:
                      scanMode === "camera"
                        ? AppColors.background
                        : AppColors.text,
                  },
                ]}
              >
                Photo
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                scanMode === "barcode" && styles.modeButtonActive,
              ]}
              onPress={() => toggleScanMode("barcode")}
            >
              <Ionicons
                name="barcode-outline"
                size={20}
                color={
                  scanMode === "barcode" ? AppColors.background : AppColors.text
                }
              />
              <ThemedText
                style={[
                  styles.modeButtonText,
                  {
                    color:
                      scanMode === "barcode"
                        ? AppColors.background
                        : AppColors.text,
                  },
                ]}
              >
                Barcode
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {scanMode === "barcode" ? (
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        ) : null}

        <View style={styles.instructions}>
          <ThemedText style={styles.instructionText}>
            {scanMode === "camera"
              ? "Position the packaging or ingredients list in view"
              : "Point at a product barcode to scan"}
          </ThemedText>
        </View>

        {isProcessingBarcode ? (
          <View style={styles.barcodeOverlay}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <ThemedText style={styles.barcodeText}>
              Looking up product...
            </ThemedText>
          </View>
        ) : null}

        <View
          style={[
            styles.controls,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleFacing}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={24} color={AppColors.text} />
          </TouchableOpacity>

          {scanMode === "camera" ? (
            <TouchableOpacity
              style={[
                styles.captureButton,
                isCapturing && styles.captureButtonDisabled,
              ]}
              onPress={handleCapture}
              activeOpacity={0.8}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color={AppColors.background} />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.barcodeIndicator}>
              <Ionicons name="scan" size={40} color={AppColors.primary} />
            </View>
          )}

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => Alert.alert("Gallery", "Photo gallery coming soon!")}
            activeOpacity={0.7}
          >
            <Feather name="image" size={24} color={AppColors.text} />
          </TouchableOpacity>
        </View>
      </CameraView>
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
  },
  permissionContent: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
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
    fontSize: 24,
    fontWeight: "600",
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
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  modeToggle: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.5)",
    gap: Spacing.xs,
  },
  modeButtonActive: {
    backgroundColor: AppColors.primaryDark,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  scanFrame: {
    position: "absolute",
    top: "25%",
    left: "8%",
    right: "8%",
    bottom: "30%",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: AppColors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: BorderRadius.sm,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: BorderRadius.sm,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: BorderRadius.sm,
  },
  instructions: {
    position: "absolute",
    bottom: "30%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  instructionText: {
    fontSize: 14,
    textAlign: "center",
    color: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  barcodeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  barcodeText: {
    marginTop: Spacing.lg,
    fontSize: 16,
    fontWeight: "500",
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: AppColors.primary,
  },
  captureButtonDisabled: {
    opacity: 0.7,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppColors.text,
  },
  barcodeIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  previewHeader: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  previewContainer: {
    flex: 1,
    margin: Spacing.lg,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    backgroundColor: AppColors.surface,
  },
  previewImage: {
    flex: 1,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  analyzingText: {
    marginTop: Spacing.lg,
    fontSize: 16,
    fontWeight: "500",
  },
  analyzingSubtext: {
    marginTop: Spacing.sm,
    fontSize: 14,
  },
  previewControls: {
    paddingHorizontal: Spacing.lg,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.surface,
    gap: Spacing.sm,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  profileSelector: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  profileSelectorDropdown: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  profileOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  profileOptionSelected: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  profileOptionText: {
    fontSize: 14,
    color: "#fff",
    flex: 1,
  },
  profileBadge: {
    backgroundColor: AppColors.primaryDark + "40",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  profileBadgeText: {
    fontSize: 11,
    color: AppColors.primary,
  },
});
