import React from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { AppColors } from "@/constants/colors";
import { Spacing } from "@/constants/theme";

const TERMS_OF_SERVICE = `Last Updated: January 2026

PLEASE READ THESE TERMS OF SERVICE CAREFULLY BEFORE USING APPERGY.

1. ACCEPTANCE OF TERMS

By downloading, installing, or using Appergy ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.

2. DESCRIPTION OF SERVICE

Appergy uses artificial intelligence (AI) technology to scan food labels, menus, and product barcodes to identify potential allergens and ingredients that may conflict with your dietary preferences or restrictions.

3. IMPORTANT DISCLAIMERS - NO MEDICAL ADVICE

THE APP DOES NOT PROVIDE MEDICAL ADVICE. The information provided by the App is for general informational purposes only and is NOT intended as a substitute for professional medical advice, diagnosis, or treatment.

You should ALWAYS:
• Consult with your doctor, allergist, or healthcare provider regarding any food allergies or dietary restrictions
• Manually verify ingredient information by reading product labels yourself
• Ask restaurant staff directly about ingredients and preparation methods
• Carry prescribed emergency medications (e.g., epinephrine auto-injectors) at all times if you have severe allergies

4. AI LIMITATIONS AND ACCURACY

The App uses AI technology that, while advanced, has inherent limitations:

• AI may misread, misinterpret, or fail to detect certain ingredients
• Image quality, lighting, and text clarity affect accuracy
• Ingredient lists may be incomplete, outdated, or contain errors
• Cross-contamination risks cannot be detected by scanning
• Menu items may contain undisclosed ingredients
• Product formulations may change without notice

The App CANNOT guarantee 100% accuracy. Always verify information independently.

5. MANUAL VERIFICATION REQUIRED

You are solely responsible for manually verifying all ingredient information before consuming any food product. The App's analysis should be used as a preliminary screening tool only, not as the final determination of food safety.

6. ASSUMPTION OF RISK

By using the App, you acknowledge and accept that:

• You use the App at your own risk
• You are responsible for verifying all food safety information
• Allergic reactions can be severe and life-threatening
• The App may not detect all allergens or harmful ingredients
• You will not rely solely on the App for allergy or dietary decisions

7. LIMITATION OF LIABILITY

TO THE MAXIMUM EXTENT PERMITTED BY LAW, APPERGY, ITS DEVELOPERS, AFFILIATES, AND SERVICE PROVIDERS SHALL NOT BE LIABLE FOR:

• Any allergic reactions, illness, injury, or death resulting from food consumption
• Any inaccuracies or errors in ingredient detection
• Any decisions made based on the App's analysis
• Any direct, indirect, incidental, special, consequential, or punitive damages
• Any loss of data or service interruptions

YOU EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE APP IS AT YOUR SOLE RISK.

8. INDEMNIFICATION

You agree to indemnify, defend, and hold harmless Appergy and its developers from any claims, damages, losses, or expenses arising from your use of the App or violation of these Terms.

9. USER RESPONSIBILITIES

You agree to:
• Provide accurate allergy and dietary information in your profile
• Keep your profile information up to date
• Verify all food safety information independently
• Not rely solely on the App for life-threatening allergy decisions
• Use the App responsibly and as intended

10. SUBSCRIPTION AND PAYMENTS

Certain features require a paid subscription. Subscription terms, pricing, and billing are handled through your device's app store. Refund policies are subject to the respective app store's terms.

11. PRIVACY

Your use of the App is also governed by our Privacy Policy. We collect and use your data as described in the Privacy Policy.

12. MODIFICATIONS TO SERVICE

We reserve the right to modify, suspend, or discontinue the App or any part thereof at any time without notice.

13. CHANGES TO TERMS

We may update these Terms of Service at any time. Continued use of the App after changes constitutes acceptance of the new terms.

14. GOVERNING LAW

These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.

15. CONTACT

For questions about these Terms of Service, please contact our support team through the App.

BY USING APPERGY, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.`;

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: AppColors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={AppColors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Terms of Service</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={true}
      >
        <ThemedText style={[styles.termsText, { color: AppColors.text }]}>
          {TERMS_OF_SERVICE}
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
