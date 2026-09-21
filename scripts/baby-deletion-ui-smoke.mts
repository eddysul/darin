import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canOfferBabyDeletion } from "../src/utils/babyDeletionEligibility.ts";
import {
  babyDeletionEn, babyDeletionEs, babyDeletionJa, babyDeletionKo, babyDeletionZhCN,
} from "../src/i18nBabyDeletionMessages.ts";

const creatorProof = { babyId: "baby-a", accountId: "account-a" };
const base = {
  babyId: "baby-a", accountId: "account-a", creatorProof,
  familyRole: "admin", busy: false,
};
assert.equal(canOfferBabyDeletion(base), true, "creator-admin sees deletion");
assert.equal(canOfferBabyDeletion({ ...base, creatorProof: null }), false, "invited admin has no creator proof");
assert.equal(canOfferBabyDeletion({ ...base, accountId: "account-b" }), false, "account switch hides action");
assert.equal(canOfferBabyDeletion({ ...base, babyId: "baby-b" }), false, "baby switch hides action");
assert.equal(canOfferBabyDeletion({ ...base, familyRole: "editor" }), false, "demoted creator cannot offer deletion");
assert.equal(canOfferBabyDeletion({ ...base, familyRole: "viewer" }), false, "viewer cannot offer deletion");
assert.equal(canOfferBabyDeletion({ ...base, busy: true }), false, "loading/deletion hides action");
assert.equal(canOfferBabyDeletion({ ...base, accountId: null }), false, "unknown session hides action");

const screen = readFileSync("src/screens/BabyProfileScreen.tsx", "utf8");
assert.match(screen, /profile\?\.createdBy === scope\.accountId/, "creator is verified from server profile");
assert.match(screen, /style: "destructive"/, "deletion requires destructive confirmation");
assert.match(screen, /\{canDeleteBaby \? \(/, "action is conditionally rendered");
assert.match(screen, /accessibilityRole="button"/, "action has button accessibility role");
for (const messages of [babyDeletionEn, babyDeletionKo, babyDeletionJa, babyDeletionEs, babyDeletionZhCN]) {
  for (const key of Object.keys(babyDeletionEn) as Array<keyof typeof babyDeletionEn>) {
    assert.ok(messages[key].trim(), `missing deletion copy: ${key}`);
  }
  assert.ok(messages["babyProfile.deleteBaby.title"].includes("{babyName}"));
}
console.log("Baby deletion UI eligibility and five-locale copy: 42 PASS");
