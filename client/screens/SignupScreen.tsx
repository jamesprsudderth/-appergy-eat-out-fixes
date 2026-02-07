import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AppColors } from "@/constants/colors";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  isFirebaseConfigured,
} from "@/services/firebase";
import { doc, setDoc } from "firebase/firestore";
import { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { useAuth } from "@/contexts/AuthContext";

// Validation schema with comprehensive rules
const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters")
      .regex(/[A-Za-z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    agreedToTerms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the Terms of Service",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

type SignupScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Signup"
>;

// Firebase error mapping
const getErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Invalid email address format.",
    "auth/weak-password": "Password is too weak. Use at least 6 characters.",
    "auth/operation-not-allowed": "Email/password accounts are not enabled.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "Firebase API key is invalid. Use Demo Mode to explore.",
  };
  return errorMessages[errorCode] || "Signup failed. Please try again.";
};

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const { setIsOnboarded, loginAsDemo } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      agreedToTerms: false,
    },
  });

  const agreedToTerms = watch("agreedToTerms");

  const onSubmit = async (data: SignupFormData) => {
    Keyboard.dismiss();

    if (!isFirebaseConfigured || !auth) {
      // Demo mode - skip Firebase, go directly to onboarding
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsOnboarded(false);
      navigation.navigate("AllergySetup");
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email.trim().toLowerCase(),
        data.password
      );
      const user = userCredential.user;

      // Save initial user data to Firestore
      if (db) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            email: user.email,
            createdAt: new Date().toISOString(),
            signupMethod: "email",
          },
          { merge: true }
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsOnboarded(false);
      navigation.navigate("AllergySetup");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = getErrorMessage(error.code);
      setError("root", { message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Login");
  };

  const handleDemoMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loginAsDemo();
  };

  const toggleTerms = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setValue("agreedToTerms", !agreedToTerms);
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
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: AppColors.primary + "20" },
          ]}
        >
          <Feather name="user-plus" size={48} color={AppColors.primary} />
        </View>
        <ThemedText style={styles.title}>Create Account</ThemedText>
        <ThemedText
          style={[styles.subtitle, { color: AppColors.secondaryText }]}
        >
          Start tracking your food allergies
        </ThemedText>

        {errors.root && (
          <View style={styles.errorContainer}>
            <Feather
              name="alert-circle"
              size={16}
              color={AppColors.destructive}
            />
            <ThemedText style={styles.errorText}>{errors.root.message}</ThemedText>
          </View>
        )}
      </View>

      <View style={styles.form}>
        {/* Email Input */}
        <View style={styles.inputWrapper}>
          <View
            style={[
              styles.inputContainer,
              errors.email && styles.inputContainerError,
            ]}
          >
            <Feather
              name="mail"
              size={20}
              color={errors.email ? AppColors.destructive : AppColors.secondaryText}
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
          {errors.email && (
            <ThemedText style={styles.fieldError}>{errors.email.message}</ThemedText>
          )}
        </View>

        {/* Password Input */}
        <View style={styles.inputWrapper}>
          <View
            style={[
              styles.inputContainer,
              errors.password && styles.inputContainerError,
            ]}
          >
            <Feather
              name="lock"
              size={20}
              color={errors.password ? AppColors.destructive : AppColors.secondaryText}
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
                  autoComplete="password-new"
                  returnKeyType="next"
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
          {errors.password && (
            <ThemedText style={styles.fieldError}>{errors.password.message}</ThemedText>
          )}
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputWrapper}>
          <View
            style={[
              styles.inputContainer,
              errors.confirmPassword && styles.inputContainerError,
            ]}
          >
            <Feather
              name="lock"
              size={20}
              color={errors.confirmPassword ? AppColors.destructive : AppColors.secondaryText}
              style={styles.inputIcon}
            />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, { color: AppColors.text }]}
                  placeholder="Confirm Password"
                  placeholderTextColor={AppColors.secondaryText}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPassword}
                  autoComplete="password-new"
                  returnKeyType="done"
                  testID="input-confirm-password"
                />
              )}
            />
          </View>
          {errors.confirmPassword && (
            <ThemedText style={styles.fieldError}>{errors.confirmPassword.message}</ThemedText>
          )}
        </View>

        {/* Terms Checkbox */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={toggleTerms}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              agreedToTerms && styles.checkboxChecked,
              errors.agreedToTerms && styles.checkboxError,
            ]}
          >
            {agreedToTerms && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
          <ThemedText
            style={[styles.termsText, { color: AppColors.secondaryText }]}
          >
            I have read and agree to the{" "}
          </ThemedText>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate("TermsOfService");
            }}
          >
            <ThemedText style={styles.termsLink}>Terms of Service</ThemedText>
          </TouchableOpacity>
        </TouchableOpacity>
        {errors.agreedToTerms && (
          <ThemedText style={[styles.fieldError, { marginTop: Spacing.xs }]}>
            {errors.agreedToTerms.message}
          </ThemedText>
        )}

        <Button
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          style={styles.signupButton}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            "Create Account"
          )}
        </Button>

        <View style={styles.loginContainer}>
          <ThemedText
            style={[styles.loginText, { color: AppColors.secondaryText }]}
          >
            Already have an account?
          </ThemedText>
          <TouchableOpacity onPress={handleLogin}>
            <ThemedText
              style={[styles.loginLink, { color: AppColors.primary }]}
            >
              {" "}
              Sign In
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
    marginBottom: Spacing["3xl"],
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
  inputWrapper: {
    marginBottom: Spacing.md,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
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
  fieldError: {
    color: AppColors.destructive,
    fontSize: 12,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  signupButton: {
    marginTop: Spacing.xl,
    backgroundColor: AppColors.primaryDark,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: AppColors.secondaryText,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: AppColors.primaryDark,
    borderColor: AppColors.primary,
  },
  checkboxError: {
    borderColor: AppColors.destructive,
  },
  termsText: {
    fontSize: 14,
  },
  termsLink: {
    fontSize: 14,
    color: AppColors.primary,
    textDecorationLine: "underline",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
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
