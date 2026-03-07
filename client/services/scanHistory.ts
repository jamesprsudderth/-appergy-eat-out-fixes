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
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

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

export function formatScanDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
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
