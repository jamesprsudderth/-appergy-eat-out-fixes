/*
 * Scan History Service
 *
 * Manages scan history storage in Firestore.
 *
 * Firestore Data Model:
 * Collection: users/{uid}/scanHistory
 * Documents: Auto-generated IDs
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { AnalysisResult } from "./ai";

export interface ScanHistoryItem {
  id: string;
  timestamp: string;
  type: "camera" | "barcode";
  productName?: string;
  ingredients: string[];
  safeCount: number;
  unsafeCount: number;
  familyChecked: boolean;
  checkedProfileNames: string[];
  results: {
    profileId: string;
    name: string;
    safe: boolean;
    status: string;
    reasons: string[];
  }[];
}

export async function saveScanToHistory(
  userId: string,
  result: AnalysisResult,
  scanType: "camera" | "barcode" = "camera",
  productName?: string
): Promise<string | null> {
  if (!db || !isFirebaseConfigured) {
    console.log("Firebase not configured, skipping history save");
    return null;
  }

  try {
    const historyRef = collection(db, "users", userId, "scanHistory");

    const safeCount = result.results.filter((r) => r.safe).length;
    const unsafeCount = result.results.filter((r) => !r.safe).length;

    const historyItem = {
      timestamp: new Date().toISOString(),
      type: scanType,
      productName: productName || undefined,
      ingredients: result.ingredients,
      safeCount,
      unsafeCount,
      familyChecked: result.results.length > 1,
      checkedProfileNames: result.results.map((r) => r.name),
      results: result.results.map((r) => ({
        profileId: r.profileId,
        name: r.name,
        safe: r.safe,
        status: r.status,
        reasons: r.reasons,
      })),
    };

    const docRef = await addDoc(historyRef, historyItem);
    return docRef.id;
  } catch (error) {
    console.error("Error saving scan to history:", error);
    return null;
  }
}

export async function getScanHistory(
  userId: string,
  maxItems: number = 50
): Promise<ScanHistoryItem[]> {
  if (!db || !isFirebaseConfigured) {
    return [];
  }

  try {
    const historyRef = collection(db, "users", userId, "scanHistory");
    const q = query(historyRef, orderBy("timestamp", "desc"), limit(maxItems));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ScanHistoryItem[];
  } catch (error) {
    console.error("Error loading scan history:", error);
    return [];
  }
}

export async function deleteScanFromHistory(
  userId: string,
  scanId: string
): Promise<boolean> {
  if (!db || !isFirebaseConfigured) return false;

  try {
    const docRef = doc(db, "users", userId, "scanHistory", scanId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting scan:", error);
    return false;
  }
}
