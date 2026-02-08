/**
 * Profile Export Service
 *
 * Generates a shareable PDF allergy profile card with:
 * - Allergen list with severity levels
 * - Dietary preferences
 * - Forbidden keywords
 * - Emergency contact info
 * - QR code linking to a read-only profile view
 * - Timestamp and expiry date
 *
 * Uses expo-print for PDF generation and expo-sharing for sharing.
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type {
  ProfileInfo,
  ProfileExport,
  AllergySeverity,
  EmergencyContact,
} from "../../shared/types";

const SEVERITY_COLORS: Record<AllergySeverity, string> = {
  mild: "#4CAF50",
  moderate: "#FF9800",
  severe: "#F44336",
  "life-threatening": "#9C27B0",
};

const SEVERITY_LABELS: Record<AllergySeverity, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  "life-threatening": "Life-Threatening",
};

/**
 * Build the profile export data object.
 */
export function buildProfileExport(
  profile: ProfileInfo,
  exportedBy: string,
  expiryDays: number = 90
): ProfileExport {
  const now = new Date();
  const expiry = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const allergies = [
    ...profile.allergies,
    ...(profile.customAllergies || []),
  ].map((name) => ({
    name,
    severity: (profile.allergySeverity?.[name] || "moderate") as AllergySeverity,
  }));

  return {
    profileId: profile.id,
    profileName: profile.name,
    allergies,
    preferences: profile.preferences,
    forbiddenKeywords: profile.forbiddenKeywords || [],
    emergencyContact: profile.emergencyContact,
    exportedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    exportedBy,
  };
}

/**
 * Generate HTML for the profile card PDF.
 */
function generateProfileCardHTML(data: ProfileExport): string {
  const exportDate = new Date(data.exportedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const expiryDate = new Date(data.expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const allergyRows = data.allergies
    .map((a) => {
      const color = SEVERITY_COLORS[a.severity];
      const label = SEVERITY_LABELS[a.severity];
      return `
        <div class="allergy-row">
          <span class="allergy-name">${a.name}</span>
          <span class="severity-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
            ${label}
          </span>
        </div>`;
    })
    .join("");

  const preferenceTags = data.preferences
    .map((p) => `<span class="pref-tag">${p}</span>`)
    .join("");

  const keywordTags = data.forbiddenKeywords
    .map((k) => `<span class="keyword-tag">${k}</span>`)
    .join("");

  const emergencySection = data.emergencyContact
    ? `
      <div class="section emergency">
        <h3>🚨 Emergency Contact</h3>
        <div class="emergency-details">
          <p><strong>${data.emergencyContact.name}</strong></p>
          <p class="phone">${data.emergencyContact.phone}</p>
          ${data.emergencyContact.relationship ? `<p class="relationship">${data.emergencyContact.relationship}</p>` : ""}
          ${data.emergencyContact.instructions ? `<div class="instructions"><strong>Instructions:</strong> ${data.emergencyContact.instructions}</div>` : ""}
        </div>
      </div>`
    : "";

  // QR code data — encode as JSON string for scanning
  const qrData = JSON.stringify({
    type: "appergy-profile",
    name: data.profileName,
    allergies: data.allergies.map((a) => `${a.name} (${a.severity})`),
    exported: data.exportedAt,
    expires: data.expiresAt,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f8f6;
      color: #1a1a1a;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      max-width: 500px;
      margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #3d7a2e 0%, #8bc66a 100%);
      padding: 24px;
      color: white;
      text-align: center;
    }
    .header h1 { font-size: 24px; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.9; }
    .header .logo { font-size: 12px; opacity: 0.7; margin-top: 8px; }
    .body { padding: 20px; }
    .section { margin-bottom: 20px; }
    .section h3 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 10px;
      border-bottom: 1px solid #eee;
      padding-bottom: 6px;
    }
    .allergy-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .allergy-name { font-size: 16px; font-weight: 600; }
    .severity-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .pref-tag {
      background: #8bc66a20;
      color: #3d7a2e;
      border: 1px solid #8bc66a40;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
    }
    .keyword-tag {
      background: #FF980020;
      color: #e65100;
      border: 1px solid #FF980040;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
    }
    .emergency {
      background: #FFF3E0;
      border-radius: 12px;
      padding: 16px;
    }
    .emergency h3 { color: #e65100; border-bottom-color: #FFB74D; }
    .emergency-details p { margin: 4px 0; }
    .phone { font-size: 20px; font-weight: 700; color: #e65100; }
    .relationship { color: #666; font-size: 13px; }
    .instructions {
      margin-top: 8px;
      background: white;
      padding: 10px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
    }
    .footer {
      background: #f8f8f6;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #999;
    }
    .expiry { color: #F44336; font-weight: 600; }
    .no-items { color: #999; font-style: italic; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${data.profileName}</h1>
      <div class="subtitle">Allergy &amp; Dietary Profile Card</div>
      <div class="logo">Generated by Appergy Scanner</div>
    </div>
    <div class="body">
      <div class="section">
        <h3>⚠️ Allergies &amp; Sensitivities</h3>
        ${allergyRows || '<p class="no-items">No allergies listed</p>'}
      </div>

      <div class="section">
        <h3>🥗 Dietary Preferences</h3>
        <div class="tags">
          ${preferenceTags || '<span class="no-items">No preferences listed</span>'}
        </div>
      </div>

      ${
        data.forbiddenKeywords.length > 0
          ? `<div class="section">
              <h3>🚫 Forbidden Ingredients</h3>
              <div class="tags">${keywordTags}</div>
            </div>`
          : ""
      }

      ${emergencySection}
    </div>
    <div class="footer">
      <span>Exported: ${exportDate}</span>
      <span class="expiry">Expires: ${expiryDate}</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate and share a PDF profile card.
 */
export async function exportProfileAsPDF(
  profile: ProfileInfo,
  exportedBy: string,
  expiryDays: number = 90
): Promise<string> {
  const exportData = buildProfileExport(profile, exportedBy, expiryDays);
  const html = generateProfileCardHTML(exportData);

  // Generate PDF
  const { uri } = await Print.printToFileAsync({
    html,
    width: 612,
    height: 792,
  });

  // Share the PDF
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `${profile.name} Allergy Profile`,
      UTI: "com.adobe.pdf",
    });
  }

  return uri;
}

/**
 * Check if a profile export has expired.
 */
export function isExportExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Generate QR code data string for a profile.
 */
export function generateQRData(profile: ProfileInfo): string {
  const allAllergies = [
    ...profile.allergies,
    ...(profile.customAllergies || []),
  ];

  return JSON.stringify({
    type: "appergy-profile",
    v: 1,
    name: profile.name,
    allergies: allAllergies.map((a) => ({
      name: a,
      severity: profile.allergySeverity?.[a] || "moderate",
    })),
    preferences: profile.preferences,
    keywords: profile.forbiddenKeywords || [],
    emergency: profile.emergencyContact || null,
    generated: new Date().toISOString(),
  });
}
