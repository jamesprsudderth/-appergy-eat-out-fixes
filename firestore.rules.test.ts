/**
 * Firestore Security Rules Tests
 *
 * Uses the Firebase Rules Unit Testing library (v2) with the local emulator.
 *
 * Prerequisites:
 *   npm install --save-dev @firebase/rules-unit-testing
 *
 * Run (emulator started by exec wrapper):
 *   npm run test:rules
 *
 * Run (emulator already running on :8080):
 *   npx tsx --test firestore.rules.test.ts
 */

import { readFileSync } from "node:fs";
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

// ── Test environment ─────────────────────────────────────────────────────────

const PROJECT_ID = "appergy-24baa";
let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ── Context helpers ───────────────────────────────────────────────────────────

const alice = () => testEnv.authenticatedContext("alice");
const bob   = () => testEnv.authenticatedContext("bob");
const anon  = () => testEnv.unauthenticatedContext();

/** Write directly without going through security rules (simulates Admin SDK). */
async function seedDoc(path: string, data: object) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

// ── users/{userId} ────────────────────────────────────────────────────────────

describe("users/{userId} — reads", () => {
  it("owner can read their own doc", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertSucceeds(getDoc(doc(alice().firestore(), "users/alice")));
  });

  it("unauthenticated user cannot read any user doc", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertFails(getDoc(doc(anon().firestore(), "users/alice")));
  });

  it("other user cannot read alice's doc", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertFails(getDoc(doc(bob().firestore(), "users/alice")));
  });
});

describe("users/{userId} — create", () => {
  it("owner can create their own doc (no subscription field)", async () => {
    await assertSucceeds(
      setDoc(doc(alice().firestore(), "users/alice"), {
        mainProfile: { name: "Alice" },
        role: "admin",
      })
    );
  });

  it("owner cannot create doc that includes a subscription field", async () => {
    await assertFails(
      setDoc(doc(alice().firestore(), "users/alice"), {
        mainProfile: {},
        subscription: { tier: "family", isActive: true },
      })
    );
  });

  it("owner cannot create a doc under a different user ID", async () => {
    await assertFails(
      setDoc(doc(alice().firestore(), "users/bob"), { mainProfile: {} })
    );
  });

  it("unauthenticated user cannot create any user doc", async () => {
    await assertFails(
      setDoc(doc(anon().firestore(), "users/alice"), { mainProfile: {} })
    );
  });
});

describe("users/{userId} — update", () => {
  it("owner can update mainProfile and role fields", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertSucceeds(
      setDoc(
        doc(alice().firestore(), "users/alice"),
        { mainProfile: { name: "Alice Updated" }, role: "admin" },
        { merge: true }
      )
    );
  });

  it("owner cannot add a subscription field via merge setDoc", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertFails(
      setDoc(
        doc(alice().firestore(), "users/alice"),
        { subscription: { tier: "family", isActive: true } },
        { merge: true }
      )
    );
  });

  it("owner cannot change an existing subscription field via merge setDoc", async () => {
    await seedDoc("users/alice", {
      mainProfile: {},
      subscription: { tier: "free", isActive: false },
    });
    await assertFails(
      setDoc(
        doc(alice().firestore(), "users/alice"),
        { subscription: { tier: "family", isActive: true } },
        { merge: true }
      )
    );
  });

  it("owner cannot patch a nested subscription sub-field via updateDoc", async () => {
    await seedDoc("users/alice", {
      mainProfile: {},
      subscription: { tier: "free", isActive: false },
    });
    await assertFails(
      updateDoc(doc(alice().firestore(), "users/alice"), {
        "subscription.tier": "family",
      })
    );
  });

  it("other user cannot update alice's doc", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertFails(
      setDoc(
        doc(bob().firestore(), "users/alice"),
        { role: "admin" },
        { merge: true }
      )
    );
  });
});

describe("users/{userId} — delete", () => {
  it("owner can delete their own doc", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertSucceeds(deleteDoc(doc(alice().firestore(), "users/alice")));
  });

  it("other user cannot delete alice's doc", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertFails(deleteDoc(doc(bob().firestore(), "users/alice")));
  });
});

describe("users/{userId} — admin SDK bypasses rules (withSecurityRulesDisabled)", () => {
  it("admin can write subscription field", async () => {
    await seedDoc("users/alice", { mainProfile: {} });
    await assertSucceeds(
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), "users/alice"),
          {
            subscription: {
              tier: "family",
              isActive: true,
              verifiedAt: new Date().toISOString(),
            },
          },
          { merge: true }
        );
      })
    );
  });
});

// ── users/{userId}/settings/{settingId} ──────────────────────────────────────

describe("users/{userId}/settings/{settingId}", () => {
  it("owner can write and read their own settings", async () => {
    const db = alice().firestore();
    await assertSucceeds(
      setDoc(doc(db, "users/alice/settings/forbiddenKeywords"), {
        keywords: ["MSG", "Artificial colors"],
      })
    );
    await assertSucceeds(
      getDoc(doc(db, "users/alice/settings/forbiddenKeywords"))
    );
  });

  it("other user cannot read owner's settings", async () => {
    await seedDoc("users/alice/settings/forbiddenKeywords", {
      keywords: ["MSG"],
    });
    await assertFails(
      getDoc(doc(bob().firestore(), "users/alice/settings/forbiddenKeywords"))
    );
  });

  it("other user cannot write to owner's settings", async () => {
    await assertFails(
      setDoc(
        doc(bob().firestore(), "users/alice/settings/forbiddenKeywords"),
        { keywords: [] }
      )
    );
  });

  it("unauthenticated user cannot access settings", async () => {
    await assertFails(
      getDoc(doc(anon().firestore(), "users/alice/settings/forbiddenKeywords"))
    );
  });
});

// ── users/{userId}/familyProfiles/{memberId} ─────────────────────────────────

describe("users/{userId}/familyProfiles/{memberId}", () => {
  it("owner can create, read, and update family profiles", async () => {
    const db = alice().firestore();
    const ref = doc(db, "users/alice/familyProfiles/member1");

    await assertSucceeds(
      setDoc(ref, {
        name: "Child",
        allergies: ["Peanuts"],
        preferences: ["Vegetarian"],
      })
    );
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      setDoc(ref, { name: "Child Updated" }, { merge: true })
    );
  });

  it("owner can delete a family profile", async () => {
    await seedDoc("users/alice/familyProfiles/member1", { name: "Child" });
    await assertSucceeds(
      deleteDoc(doc(alice().firestore(), "users/alice/familyProfiles/member1"))
    );
  });

  it("other user cannot read alice's family profiles", async () => {
    await seedDoc("users/alice/familyProfiles/member1", { name: "Child" });
    await assertFails(
      getDoc(doc(bob().firestore(), "users/alice/familyProfiles/member1"))
    );
  });

  it("other user cannot write to alice's family profiles", async () => {
    await assertFails(
      setDoc(doc(bob().firestore(), "users/alice/familyProfiles/member1"), {
        name: "Hacked",
      })
    );
  });

  it("unauthenticated user cannot access family profiles", async () => {
    await assertFails(
      getDoc(doc(anon().firestore(), "users/alice/familyProfiles/member1"))
    );
  });
});

// ── users/{userId}/savedRecipes/{recipeId} ───────────────────────────────────

describe("users/{userId}/savedRecipes/{recipeId}", () => {
  it("owner can read and write their saved recipes", async () => {
    const db = alice().firestore();
    const ref = doc(db, "users/alice/savedRecipes/recipe1");
    await assertSucceeds(setDoc(ref, { title: "Gluten-Free Pasta" }));
    await assertSucceeds(getDoc(ref));
  });

  it("other user cannot access alice's saved recipes", async () => {
    await seedDoc("users/alice/savedRecipes/recipe1", { title: "Pasta" });
    await assertFails(
      getDoc(doc(bob().firestore(), "users/alice/savedRecipes/recipe1"))
    );
    await assertFails(
      setDoc(doc(bob().firestore(), "users/alice/savedRecipes/recipe1"), {
        title: "Hacked",
      })
    );
  });
});

// ── users/{userId}/scanHistory/{scanId} ──────────────────────────────────────

describe("users/{userId}/scanHistory/{scanId}", () => {
  it("owner can read and write their scan history", async () => {
    const db = alice().firestore();
    const ref = doc(db, "users/alice/scanHistory/scan1");
    await assertSucceeds(
      setDoc(ref, { verdict: "Safe", scannedAt: new Date().toISOString() })
    );
    await assertSucceeds(getDoc(ref));
  });

  it("other user cannot read alice's scan history", async () => {
    await seedDoc("users/alice/scanHistory/scan1", { verdict: "Safe" });
    await assertFails(
      getDoc(doc(bob().firestore(), "users/alice/scanHistory/scan1"))
    );
  });
});

// ── catch-all: unmatched paths ────────────────────────────────────────────────

describe("unmatched paths are blocked", () => {
  it("cannot read from an arbitrary top-level collection", async () => {
    await assertFails(
      getDoc(doc(alice().firestore(), "admin/secrets"))
    );
  });

  it("cannot write to an arbitrary top-level collection", async () => {
    await assertFails(
      setDoc(doc(alice().firestore(), "admin/secrets"), { key: "value" })
    );
  });
});
