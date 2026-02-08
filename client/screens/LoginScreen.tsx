import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { sendPasswordResetEmail } from "firebase/auth";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  auth,
  db,
  signInWithEmailAndPassword,
  isFirebaseConfigured,
} from "@/services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { useAuth } from "@/contexts/AuthContext";

// Validation schema with detailed messages
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Login"
>;

// Firebase error code mapping
const getErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-email": "Invalid email address format.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "Firebase API key is invalid. Use Demo Mode to explore.",
  };
  return errorMessages[errorCode] || "Login failed. Please try again.";
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { setIsOnboarded, loginAsDemo, refreshUserProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const watchedEmail = watch("email");

  const onSubmit = async (data: LoginFormData) => {
    Keyboard.dismiss();

    if (!isFirebaseConfigured || !auth) {
      setError("root", {
        message:
          "Firebase is not configured. Use Demo Mode to explore the app.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email.trim().toLowerCase(),
        data.password,
      );
      const user = userCredential.user;

      // Check if user has completed onboarding
      if (db) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const hasAllergies =
            userData.mainProfile?.allergies?.common?.length > 0 ||
            userData.mainProfile?.allergies?.custom?.length > 0 ||
            userData.mainProfile?.allergies?.none === true;
          const hasPreferences =
            userData.mainProfile?.preferences?.common?.length > 0 ||
            userData.mainProfile?.preferences?.custom?.length > 0 ||
            userData.mainProfile?.preferences?.none === true;

          if (hasAllergies && hasPreferences) {
            // Load profile into context BEFORE switching to main
            await refreshUserProfile();
            setIsOnboarded(true);
          } else {
            setIsOnboarded(false);
            navigation.navigate("AllergySetup");
            return;
          }
        } else {
          // New user with no profile data
          setIsOnboarded(false);
          navigation.navigate("AllergySetup");
          return;
        }
      } else {
        // No Firestore — try to load cached profile
        await refreshUserProfile();
        setIsOnboarded(true);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = getErrorMessage(error.code);
      setError("root", { message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!watchedEmail?.trim()) {
      Alert.alert(
        "Enter Email",
        "Please enter your email address first, then tap Forgot Password.",
      );
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      Alert.alert(
        "Not Available",
        "Password reset is not available in demo mode.",
      );
      return;
    }

    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, watchedEmail.trim().toLowerCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Email Sent",
        `Password reset instructions have been sent to ${watchedEmail.trim()}. Check your inbox and spam folder.`,
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessages: Record<string, string> = {
        "auth/user-not-found": "No account found with this email.",
        "auth/invalid-email": "Invalid email address.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
      };
      Alert.alert(
        "Error",
        errorMessages[error.code] ||
          "Failed to send reset email. Please try again.",
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Signup");
  };

  const handleDemoMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loginAsDemo();
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: AppColors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: insets.top + Spacing["4xl"],
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/login-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText style={styles.title}>Appergy</ThemedText>
        <ThemedText
          style={[styles.subtitle, { color: AppColors.secondaryText }]}
        >
          Sign in to manage your allergies
        </ThemedText>

        {(errors.root || errors.email || errors.password) && (
          <View style={styles.errorContainer}>
            <Feather
              name="alert-circle"
              size={16}
              color={AppColors.destructive}
            />
            <ThemedText style={styles.errorText}>
              {errors.root?.message ||
                errors.email?.message ||
                errors.password?.message}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.form}>
        <View
          style={[
            styles.inputContainer,
            errors.email && styles.inputContainerError,
          ]}
        >
          <Feather
            name="mail"
            size={20}
            color={
              errors.email ? AppColors.destructive : AppColors.secondaryText
            }
            style={styles.inputIcon}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { color: AppColors.text }]}
                placeholder="Email"
                placeholderTextColor={AppColors.secondaryText}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
                testID="input-email"
              />
            )}
          />
        </View>

        <View
          style={[
            styles.inputContainer,
            errors.password && styles.inputContainerError,
          ]}
        >
          <Feather
            name="lock"
            size={20}
            color={
              errors.password ? AppColors.destructive : AppColors.secondaryText
            }
            style={styles.inputIcon}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { color: AppColors.text }]}
                placeholder="Password"
                placeholderTextColor={AppColors.secondaryText}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit(onSubmit)}
                testID="input-password"
              />
            )}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.passwordToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={AppColors.secondaryText}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.forgotPasswordButton}
          onPress={handleForgotPassword}
          disabled={isResettingPassword}
        >
          {isResettingPassword ? (
            <ActivityIndicator size="small" color={AppColors.primary} />
          ) : (
            <ThemedText
              style={[styles.forgotPasswordText, { color: AppColors.primary }]}
            >
              Forgot Password?
            </ThemedText>
          )}
        </TouchableOpacity>

        <Button
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          style={styles.loginButton}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : "Sign In"}
        </Button>

        <View style={styles.signupContainer}>
          <ThemedText
            style={[styles.signupText, { color: AppColors.secondaryText }]}
          >
            Don&apos;t have an account?
          </ThemedText>
          <TouchableOpacity onPress={handleSignUp}>
            <ThemedText
              style={[styles.signupLink, { color: AppColors.primary }]}
            >
              {" "}
              Sign Up
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.demoSection}>
          <View style={styles.dividerRow}>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: AppColors.divider },
              ]}
            />
            <ThemedText
              style={[styles.dividerText, { color: AppColors.secondaryText }]}
            >
              or
            </ThemedText>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: AppColors.divider },
              ]}
            />
          </View>
          <TouchableOpacity
            style={[styles.demoButton, { backgroundColor: AppColors.surface }]}
            onPress={handleDemoMode}
            activeOpacity={0.7}
          >
            <Feather name="play-circle" size={20} color={AppColors.primary} />
            <ThemedText
              style={[styles.demoButtonText, { color: AppColors.text }]}
            >
              Try Demo Mode
            </ThemedText>
          </TouchableOpacity>
          <ThemedText
            style={[styles.demoHint, { color: AppColors.secondaryText }]}
          >
            Explore the app without signing up
          </ThemedText>
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    height: 56,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputContainerError: {
    borderColor: AppColors.destructive,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  passwordToggle: {
    padding: Spacing.sm,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "500",
  },
  loginButton: {
    marginTop: Spacing.md,
    backgroundColor: AppColors.primaryDark,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  demoSection: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: 14,
  },
  demoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    width: "100%",
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  demoHint: {
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.destructive + "20",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  errorText: {
    color: AppColors.destructive,
    fontSize: 14,
    flex: 1,
  },
});
