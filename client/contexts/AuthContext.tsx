import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  User,
  isFirebaseConfigured,
} from "@/services/firebase";

// Storage keys
const STORAGE_KEYS = {
  IS_ONBOARDED: "@appergy_is_onboarded",
  IS_DEMO_MODE: "@appergy_is_demo_mode",
  DEMO_USER_DATA: "@appergy_demo_user_data",
  USER_PROFILE: "@appergy_user_profile",
} as const;

interface DemoUser {
  uid: string;
  email: string;
  displayName: string | null;
}

// User profile data structure
export interface UserProfile {
  name?: string;
  allergies: {
    common: string[];
    custom: string[];
    none: boolean;
  };
  preferences: {
    common: string[];
    custom: string[];
    none: boolean;
  };
  forbiddenKeywords: string[];
}

interface AuthContextType {
  user: User | DemoUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  isFirebaseReady: boolean;
  isDemoMode: boolean;
  setIsOnboarded: (value: boolean) => void;
  logout: () => Promise<void>;
  loginAsDemo: () => void;
  refreshUserProfile: () => Promise<void>;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
}

const defaultProfile: UserProfile = {
  allergies: { common: [], custom: [], none: false },
  preferences: { common: [], custom: [], none: false },
  forbiddenKeywords: [],
};

const demoProfile: UserProfile = {
  name: "Demo User",
  allergies: { common: ["Dairy", "Peanuts"], custom: [], none: false },
  preferences: { common: ["Vegetarian"], custom: [], none: false },
  forbiddenKeywords: ["MSG", "Artificial colors"],
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isLoading: true,
  isOnboarded: false,
  isFirebaseReady: false,
  isDemoMode: false,
  setIsOnboarded: () => {},
  logout: async () => {},
  loginAsDemo: () => {},
  refreshUserProfile: async () => {},
  updateUserProfile: async () => {},
});

const DEMO_USER: DemoUser = {
  uid: "demo-user-001",
  email: "demo@appergy.app",
  displayName: "Demo User",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | DemoUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          setIsDemoMode(false);

          // Load user profile and check onboarding status
          await loadUserProfile(firebaseUser.uid);
        } else {
          // Check if we have a demo user stored
          const storedDemoMode = await AsyncStorage.getItem(
            STORAGE_KEYS.IS_DEMO_MODE,
          );
          if (storedDemoMode === "true") {
            setUser(DEMO_USER);
            setUserProfile(demoProfile);
            setIsDemoMode(true);
          } else {
            setUser(null);
            setUserProfile(null);
            setIsDemoMode(false);
          }
        }
        setIsLoading(false);
      });
      return unsubscribe;
    } else {
      // No Firebase, check for demo mode
      loadDemoModeState();
    }
  }, []);

  const loadPersistedState = async () => {
    try {
      const [storedOnboarded, storedDemoMode, storedProfile] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.IS_ONBOARDED),
          AsyncStorage.getItem(STORAGE_KEYS.IS_DEMO_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE),
        ]);

      if (storedOnboarded === "true") {
        setIsOnboardedState(true);
      }

      if (storedDemoMode === "true") {
        setIsDemoMode(true);
        setUser(DEMO_USER);
        setUserProfile(demoProfile);
      } else if (storedProfile) {
        try {
          setUserProfile(JSON.parse(storedProfile));
        } catch {
          // Invalid JSON, ignore
        }
      }
    } catch (error) {
      console.error("Error loading persisted auth state:", error);
    }
  };

  const loadDemoModeState = async () => {
    try {
      const storedDemoMode = await AsyncStorage.getItem(
        STORAGE_KEYS.IS_DEMO_MODE,
      );
      const storedOnboarded = await AsyncStorage.getItem(
        STORAGE_KEYS.IS_ONBOARDED,
      );

      if (storedDemoMode === "true") {
        setUser(DEMO_USER);
        setUserProfile(demoProfile);
        setIsDemoMode(true);
        setIsOnboardedState(storedOnboarded === "true");
      }
    } catch (error) {
      console.error("Error loading demo mode state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    if (!db || !isFirebaseConfigured) {
      // Check local storage as fallback
      const storedOnboarded = await AsyncStorage.getItem(
        STORAGE_KEYS.IS_ONBOARDED,
      );
      setIsOnboardedState(storedOnboarded === "true");
      return;
    }

    try {
      // Load main profile
      const userDoc = await getDoc(doc(db, "users", userId));

      // Load forbidden keywords
      let forbiddenKeywords: string[] = [];
      try {
        const keywordsDoc = await getDoc(
          doc(db, "users", userId, "settings", "forbiddenKeywords"),
        );
        if (keywordsDoc.exists()) {
          forbiddenKeywords = keywordsDoc.data().keywords || [];
        }
      } catch (e) {
        console.log("No forbidden keywords found");
      }

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const mainProfile = userData.mainProfile || {};

        const profile: UserProfile = {
          name: mainProfile.name,
          allergies: {
            common: mainProfile.allergies?.common || [],
            custom: mainProfile.allergies?.custom || [],
            none: mainProfile.allergies?.none || false,
          },
          preferences: {
            common: mainProfile.preferences?.common || [],
            custom: mainProfile.preferences?.custom || [],
            none: mainProfile.preferences?.none || false,
          },
          forbiddenKeywords,
        };

        setUserProfile(profile);

        // Cache profile locally
        await AsyncStorage.setItem(
          STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(profile),
        );

        // Check onboarding status
        const hasAllergies =
          profile.allergies.common.length > 0 ||
          profile.allergies.custom.length > 0 ||
          profile.allergies.none === true;
        const hasPreferences =
          profile.preferences.common.length > 0 ||
          profile.preferences.custom.length > 0 ||
          profile.preferences.none === true;

        const hasCompletedOnboarding = hasAllergies && hasPreferences;
        setIsOnboardedState(hasCompletedOnboarding);

        await AsyncStorage.setItem(
          STORAGE_KEYS.IS_ONBOARDED,
          hasCompletedOnboarding ? "true" : "false",
        );

        console.log("User profile loaded:", {
          allergies:
            profile.allergies.common.length + profile.allergies.custom.length,
          preferences:
            profile.preferences.common.length +
            profile.preferences.custom.length,
          onboarded: hasCompletedOnboarding,
        });
      } else {
        setUserProfile({ ...defaultProfile, forbiddenKeywords });
        setIsOnboardedState(false);
        await AsyncStorage.setItem(STORAGE_KEYS.IS_ONBOARDED, "false");
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      // Fall back to local storage
      const storedOnboarded = await AsyncStorage.getItem(
        STORAGE_KEYS.IS_ONBOARDED,
      );
      setIsOnboardedState(storedOnboarded === "true");

      const storedProfile = await AsyncStorage.getItem(
        STORAGE_KEYS.USER_PROFILE,
      );
      if (storedProfile) {
        try {
          setUserProfile(JSON.parse(storedProfile));
        } catch {
          setUserProfile(defaultProfile);
        }
      }
    }
  };

  const setIsOnboarded = useCallback(async (value: boolean) => {
    setIsOnboardedState(value);
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.IS_ONBOARDED,
        value ? "true" : "false",
      );
    } catch (error) {
      console.error("Error persisting onboarded state:", error);
    }
  }, []);

  const loginAsDemo = useCallback(async () => {
    setUser(DEMO_USER);
    setUserProfile(demoProfile);
    setIsDemoMode(true);
    setIsOnboardedState(true);
    setIsLoading(false);

    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.IS_DEMO_MODE, "true"),
        AsyncStorage.setItem(STORAGE_KEYS.IS_ONBOARDED, "true"),
      ]);
    } catch (error) {
      console.error("Error persisting demo mode:", error);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Clear all persisted state
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.IS_ONBOARDED),
        AsyncStorage.removeItem(STORAGE_KEYS.IS_DEMO_MODE),
        AsyncStorage.removeItem(STORAGE_KEYS.DEMO_USER_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE),
      ]);

      // Clear in-memory state immediately so navigator switches to Auth
      setUserProfile(null);
      setIsOnboardedState(false);
      setIsDemoMode(false);

      if (isDemoMode) {
        setUser(null);
      } else if (auth) {
        // signOut triggers onAuthStateChanged which will also setUser(null),
        // but we set it explicitly to avoid any timing gaps
        setUser(null);
        await signOut(auth);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Force clear state even on error
      setUser(null);
      setUserProfile(null);
      setIsDemoMode(false);
      setIsOnboardedState(false);
    }
  }, [isDemoMode]);

  const refreshUserProfile = useCallback(async () => {
    if (user && !isDemoMode && db && isFirebaseConfigured) {
      await loadUserProfile(user.uid);
    } else if (isDemoMode) {
      setUserProfile(demoProfile);
    }
  }, [user, isDemoMode]);

  /**
   * Update the user profile in both Firestore (or AsyncStorage for demo)
   * and in the local AuthContext state. This is the single source of truth
   * for profile mutations — screens should call this instead of writing
   * to Firestore directly.
   */
  const updateUserProfile = useCallback(
    async (profile: UserProfile) => {
      // Update local state immediately
      setUserProfile(profile);

      // Persist to AsyncStorage (works for both demo and Firebase modes)
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(profile),
        );
      } catch (error) {
        console.error("Error caching profile:", error);
      }

      // If Firebase is available and not in demo mode, also persist to Firestore
      if (user && !isDemoMode && db && isFirebaseConfigured) {
        try {
          const docRef = doc(db, "users", user.uid);
          await setDoc(
            docRef,
            {
              mainProfile: {
                name: profile.name,
                allergies: {
                  common: profile.allergies.common,
                  custom: profile.allergies.custom,
                  none: profile.allergies.none,
                },
                preferences: {
                  common: profile.preferences.common,
                  custom: profile.preferences.custom,
                  none: profile.preferences.none,
                },
                updatedAt: new Date().toISOString(),
              },
            },
            { merge: true },
          );

          // Save forbidden keywords separately
          if (
            profile.forbiddenKeywords &&
            profile.forbiddenKeywords.length > 0
          ) {
            const keywordsRef = doc(
              db,
              "users",
              user.uid,
              "settings",
              "forbiddenKeywords",
            );
            await setDoc(keywordsRef, {
              keywords: profile.forbiddenKeywords,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("Error saving profile to Firestore:", error);
          throw error; // Let the caller know it failed
        }
      }

      // Update onboarding status
      const hasAllergies =
        profile.allergies.common.length > 0 ||
        profile.allergies.custom.length > 0 ||
        profile.allergies.none === true;
      const hasPreferences =
        profile.preferences.common.length > 0 ||
        profile.preferences.custom.length > 0 ||
        profile.preferences.none === true;

      if (hasAllergies && hasPreferences) {
        setIsOnboardedState(true);
        await AsyncStorage.setItem(STORAGE_KEYS.IS_ONBOARDED, "true");
      }
    },
    [user, isDemoMode],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isLoading,
        isOnboarded,
        isFirebaseReady: isFirebaseConfigured,
        isDemoMode,
        setIsOnboarded,
        logout,
        loginAsDemo,
        refreshUserProfile,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
