/**
 * Comprehensive Automated Verification Suite for Google Authentication
 *
 * Verifies:
 * 1. Missing idToken -> 400
 * 2. Invalid Google token / token verification errors -> 401
 * 3. Expired token / unverified email / audience mismatch -> 401
 * 4. New user signup with Google:
 *    - Correct user creation with provider: "google"
 *    - Session token issued
 *    - Activity history logged
 * 5. Existing user with email/password:
 *    - Logs in with Google successfully
 *    - NO duplicate user record created
 *    - Preserves existing user ID
 *    - Preserves existing passwordHash (NOT erased or modified)
 *    - Existing user can STILL log in with email/password afterwards!
 * 6. Session persistence:
 *    - Token issued by Google login allows authenticated access to GET /api/users/me
 * 7. Lockout reset:
 *    - Failed password attempts reset upon successful Google login
 * 8. Public config:
 *    - GET /api/config/public returns google_login_enabled: "true"
 */

import http from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import app from "./app";
import { db, usersTable, userActivityHistoryTable, appConfigTable, adminUsersTable, adminSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { setCustomVerifierForTesting, type GoogleTokenPayload } from "./lib/googleAuth";
import { ensureGoogleLoginConfig } from "./lib/config";

async function runGoogleAuthTests() {
  console.log("\n========================================================");
  console.log("  GOOGLE SIGN-IN & AUTH PIPELINE - VERIFICATION SUITE");
  console.log("========================================================\n");

  await ensureGoogleLoginConfig();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  Test server listening on port ${port}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Public config returns google_login_enabled: "true"
    // -------------------------------------------------------------------------
    console.log("[1/8] Verifying public configuration endpoint...");
    const configRes = await fetch(`${baseUrl}/api/config/public`);
    if (!configRes.ok) throw new Error(`GET /config/public failed with ${configRes.status}`);
    const configData = await configRes.json();
    if (configData.google_login_enabled !== "true") {
      throw new Error(`Expected google_login_enabled to be "true", got: "${configData.google_login_enabled}"`);
    }
    console.log("  ✓ /api/config/public returns google_login_enabled: 'true'\n");

    // -------------------------------------------------------------------------
    // TEST 2: Missing idToken returns 400
    // -------------------------------------------------------------------------
    console.log("[2/8] Testing validation: missing idToken returns 400...");
    const missingRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (missingRes.status !== 400) {
      throw new Error(`Expected 400 for missing idToken, got ${missingRes.status}`);
    }
    console.log("  ✓ Correctly rejected with 400\n");

    // -------------------------------------------------------------------------
    // TEST 3: Invalid token verification failures return 401
    // -------------------------------------------------------------------------
    console.log("[3/8] Testing token verification rejection rules (401)...");

    // 3a. Invalid issuer
    setCustomVerifierForTesting(async () => ({
      iss: "untrusted-issuer.com",
      sub: "g123",
      email: "test@example.com",
      email_verified: true,
      aud: "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));
    const badIssRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "mock_bad_issuer" }),
    });
    if (badIssRes.status !== 401) throw new Error(`Expected 401 for bad issuer, got ${badIssRes.status}`);

    // 3b. Expired token
    setCustomVerifierForTesting(async () => ({
      iss: "https://accounts.google.com",
      sub: "g123",
      email: "test@example.com",
      email_verified: true,
      aud: "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) - 60, // expired
    }));
    const expiredRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "mock_expired" }),
    });
    if (expiredRes.status !== 401) throw new Error(`Expected 401 for expired token, got ${expiredRes.status}`);

    // 3c. Unverified email
    setCustomVerifierForTesting(async () => ({
      iss: "https://accounts.google.com",
      sub: "g123",
      email: "test@example.com",
      email_verified: false,
      aud: "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));
    const unverifiedRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "mock_unverified" }),
    });
    if (unverifiedRes.status !== 401) throw new Error(`Expected 401 for unverified email, got ${unverifiedRes.status}`);

    // 3d. Audience mismatch
    setCustomVerifierForTesting(async () => ({
      iss: "https://accounts.google.com",
      sub: "g123",
      email: "test@example.com",
      email_verified: true,
      aud: "malicious-app-client-id.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));
    const audRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "mock_bad_aud" }),
    });
    if (audRes.status !== 401) throw new Error(`Expected 401 for audience mismatch, got ${audRes.status}`);

    console.log("  ✓ All token verification security rules strictly enforced (401)\n");

    // -------------------------------------------------------------------------
    // TEST 4: New user signup with Google
    // -------------------------------------------------------------------------
    console.log("[4/8] Testing new user creation via Google Sign-In...");
    const testNewEmail = `guser_${crypto.randomBytes(6).toString("hex")}@example.com`;
    const googleSub = "gsub_" + crypto.randomBytes(8).toString("hex");

    setCustomVerifierForTesting(async () => ({
      iss: "https://accounts.google.com",
      sub: googleSub,
      email: testNewEmail,
      email_verified: true,
      name: "Google New User",
      picture: "https://lh3.googleusercontent.com/a/avatar123",
      aud: "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));

    const createRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid_token_new_user" }),
    });

    if (createRes.status !== 201) {
      const errText = await createRes.text();
      throw new Error(`Expected 201 for new user creation, got ${createRes.status}: ${errText}`);
    }

    const createdData = await createRes.json();
    if (!createdData.id || !createdData.token) {
      throw new Error("Created user response missing id or session token");
    }
    if (createdData.email !== testNewEmail) {
      throw new Error(`Email mismatch: expected ${testNewEmail}, got ${createdData.email}`);
    }
    if (createdData.provider !== "google") {
      throw new Error(`Provider mismatch: expected "google", got ${createdData.provider}`);
    }
    if (createdData.hasPassword !== false) {
      throw new Error("hasPassword should be false for newly created Google user");
    }

    // Verify DB record directly
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.email, testNewEmail));
    if (!dbUser) throw new Error("User record not found in database");
    if (dbUser.passwordHash !== null) throw new Error("passwordHash must be null for pure Google user");
    if (dbUser.avatar !== "https://lh3.googleusercontent.com/a/avatar123") {
      throw new Error("Avatar was not stored properly");
    }

    // Verify Activity Log
    const [activity] = await db
      .select()
      .from(userActivityHistoryTable)
      .where(eq(userActivityHistoryTable.userId, dbUser.id))
      .orderBy(desc(userActivityHistoryTable.createdAt))
      .limit(1);

    if (!activity || activity.eventType !== "ACCOUNT_CREATED") {
      throw new Error("ACCOUNT_CREATED activity was not logged for Google user");
    }

    console.log("  ✓ New user successfully created with provider 'google' and session token\n");

    // -------------------------------------------------------------------------
    // TEST 5: Existing email/password user logs in with Google (Linking & No Duplication)
    // -------------------------------------------------------------------------
    console.log("[5/8] Testing existing email/password user login via Google...");
    const existingEmail = `pwduser_${crypto.randomBytes(6).toString("hex")}@example.com`;
    const originalPassword = "SecretPassword123!";
    const originalPasswordHash = await bcrypt.hash(originalPassword, 10);
    const originalUserId = "user_pwd_" + crypto.randomBytes(8).toString("hex");

    // Seed existing email/password user
    await db.insert(usersTable).values({
      id: originalUserId,
      email: existingEmail,
      name: "Original User",
      passwordHash: originalPasswordHash,
      provider: "email",
      failedLoginAttempts: 3, // Simulate previous failed attempts
    });

    // Existing user signs in with Google
    setCustomVerifierForTesting(async () => ({
      iss: "https://accounts.google.com",
      sub: "gsub_linked_" + crypto.randomBytes(6).toString("hex"),
      email: existingEmail,
      email_verified: true,
      name: "Original User",
      picture: "https://lh3.googleusercontent.com/a/avatar_linked",
      aud: "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));

    const linkRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid_token_existing_user" }),
    });

    if (linkRes.status !== 200) {
      const errText = await linkRes.text();
      throw new Error(`Expected 200 for existing user login with Google, got ${linkRes.status}: ${errText}`);
    }

    const linkData = await linkRes.json();
    if (linkData.id !== originalUserId) {
      throw new Error(`Expected user ID to remain ${originalUserId}, got ${linkData.id}`);
    }
    if (!linkData.token) {
      throw new Error("Missing session token for existing user Google login");
    }
    if (linkData.hasPassword !== true) {
      throw new Error("hasPassword should remain true for user with existing password");
    }

    // Verify DB integrity
    const matchedUsers = await db.select().from(usersTable).where(eq(usersTable.email, existingEmail));
    if (matchedUsers.length !== 1) {
      throw new Error(`DUPLICATE DETECTED! Expected exactly 1 user for email, found: ${matchedUsers.length}`);
    }
    const [updatedDbUser] = matchedUsers;
    if (updatedDbUser.passwordHash !== originalPasswordHash) {
      throw new Error("CRITICAL: passwordHash was modified or erased!");
    }
    if (updatedDbUser.failedLoginAttempts !== 0) {
      throw new Error("Failed login attempts were not reset on successful Google login");
    }

    console.log("  ✓ Preserved existing user record, ID, and passwordHash without duplication\n");

    // -------------------------------------------------------------------------
    // TEST 6: User can STILL login with email/password after using Google
    // -------------------------------------------------------------------------
    console.log("[6/8] Verifying email/password login still works for the same user...");
    const emailLoginRes = await fetch(`${baseUrl}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: existingEmail, password: originalPassword }),
    });

    if (!emailLoginRes.ok) {
      const err = await emailLoginRes.text();
      throw new Error(`Email/password login failed after Google sign-in: ${emailLoginRes.status}: ${err}`);
    }

    const emailLoginData = await emailLoginRes.json();
    if (emailLoginData.id !== originalUserId) {
      throw new Error("Email login returned wrong user ID");
    }
    console.log("  ✓ Email/password authentication remains 100% functional\n");

    // -------------------------------------------------------------------------
    // TEST 7: Session token persistence and authentication via /api/users/me
    // -------------------------------------------------------------------------
    console.log("[7/8] Verifying session token persistence with GET /api/users/me...");
    const meRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${linkData.token}` },
    });

    if (!meRes.ok) {
      throw new Error(`GET /users/me failed with session token: ${meRes.status}`);
    }

    const meData = await meRes.json();
    if (meData.id !== originalUserId || meData.email !== existingEmail) {
      throw new Error("GET /users/me returned incorrect user data");
    }
    console.log("  ✓ Session token issued by Google login successfully authenticates API requests\n");

    // -------------------------------------------------------------------------
    // TEST 8: Account lockout recovery via Google Login
    // -------------------------------------------------------------------------
    console.log("[8/8] Verifying lockout clearance via Google Login...");
    const lockedEmail = `locked_${crypto.randomBytes(6).toString("hex")}@example.com`;
    const lockedUserId = "user_locked_" + crypto.randomBytes(8).toString("hex");
    const futureLock = new Date(Date.now() + 15 * 60 * 1000);

    await db.insert(usersTable).values({
      id: lockedUserId,
      email: lockedEmail,
      name: "Locked User",
      passwordHash: await bcrypt.hash("pass", 10),
      provider: "email",
      failedLoginAttempts: 10,
      lockedUntil: futureLock,
    });

    // Logging in with Google resets lockout
    setCustomVerifierForTesting(async () => ({
      iss: "https://accounts.google.com",
      sub: "gsub_lock_" + crypto.randomBytes(6).toString("hex"),
      email: lockedEmail,
      email_verified: true,
      name: "Locked User",
      aud: "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));

    const unlockGoogleRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token_unlock_user" }),
    });

    if (!unlockGoogleRes.ok) {
      throw new Error(`Google login failed for locked user: ${unlockGoogleRes.status}`);
    }

    const [unlockedDbUser] = await db.select().from(usersTable).where(eq(usersTable.id, lockedUserId));
    if (unlockedDbUser.lockedUntil !== null || unlockedDbUser.failedLoginAttempts !== 0) {
      throw new Error("Lockout was not cleared on successful Google sign-in");
    }
    console.log("  ✓ Lockout cleared and failed attempts reset successfully\n");

    // -------------------------------------------------------------------------
    // TEST 9: Admin disables Google Sign-In: 403 Forbidden enforcement
    // -------------------------------------------------------------------------
    console.log("[9/11] Testing toggle: disabling Google Sign-In enforces 403 Forbidden...");
    await db
      .update(appConfigTable)
      .set({ value: "false", updatedAt: new Date() })
      .where(eq(appConfigTable.key, "google_login_enabled"));

    // 9a. Verify /api/config/public returns "false"
    const publicDisabledRes = await fetch(`${baseUrl}/api/config/public`);
    const publicDisabledData = await publicDisabledRes.json();
    if (publicDisabledData.google_login_enabled !== "false") {
      throw new Error(`Expected /api/config/public to return "false", got "${publicDisabledData.google_login_enabled}"`);
    }

    // 9b. Verify POST /api/users/google rejects with 403 Forbidden
    const disabledAuthEmail = `disabled_test_${crypto.randomBytes(6).toString("hex")}@example.com`;
    setCustomVerifierForTesting(async () => ({
      iss: "https://accounts.google.com",
      sub: "gsub_disabled",
      email: disabledAuthEmail,
      email_verified: true,
      name: "Disabled User",
      aud: "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));

    const disabledGoogleRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid_token_while_disabled" }),
    });

    if (disabledGoogleRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden when Google Sign-In is disabled, got ${disabledGoogleRes.status}`);
    }
    const disabledJson = await disabledGoogleRes.json();
    if (!disabledJson.error || !disabledJson.error.includes("disabled")) {
      throw new Error(`Expected error message to mention disabled, got: ${JSON.stringify(disabledJson)}`);
    }

    // 9c. Verify NO user was created in database
    const [noUser] = await db.select().from(usersTable).where(eq(usersTable.email, disabledAuthEmail));
    if (noUser) {
      throw new Error("User was created in database despite Google Sign-In being disabled!");
    }

    // 9d. Verify email/password login still works while Google Sign-In is disabled
    const emailLoginStillWorksRes = await fetch(`${baseUrl}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: existingEmail, password: originalPassword }),
    });
    if (!emailLoginStillWorksRes.ok) {
      throw new Error("Email/password login failed while Google Sign-In was disabled!");
    }
    console.log("  ✓ Disabled toggle returns 'false' in public config, rejects API with 403, creates no user, and preserves email/password login\n");

    // -------------------------------------------------------------------------
    // TEST 10: ensureGoogleLoginConfig() does NOT overwrite "false" on restart
    // -------------------------------------------------------------------------
    console.log("[10/11] Testing restart persistence: ensureGoogleLoginConfig() preserves 'false'...");
    await ensureGoogleLoginConfig(); // Simulate server restart

    const [rowAfterRestart] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "google_login_enabled"));

    if (!rowAfterRestart || rowAfterRestart.value !== "false") {
      throw new Error(`CRITICAL: Server restart overwrote admin setting! Expected "false", got "${rowAfterRestart?.value}"`);
    }

    const publicAfterRestartRes = await fetch(`${baseUrl}/api/config/public`);
    const publicAfterRestartData = await publicAfterRestartRes.json();
    if (publicAfterRestartData.google_login_enabled !== "false") {
      throw new Error(`Public config after restart returned "${publicAfterRestartData.google_login_enabled}" instead of "false"`);
    }
    console.log("  ✓ Server restart does NOT overwrite administrator's 'false' choice\n");

    // -------------------------------------------------------------------------
    // TEST 11: Re-enabling Google Sign-In restores authentication
    // -------------------------------------------------------------------------
    console.log("[11/11] Testing re-enabling Google Sign-In restores normal operation...");
    await db
      .update(appConfigTable)
      .set({ value: "true", updatedAt: new Date() })
      .where(eq(appConfigTable.key, "google_login_enabled"));

    const publicReenabledRes = await fetch(`${baseUrl}/api/config/public`);
    const publicReenabledData = await publicReenabledRes.json();
    if (publicReenabledData.google_login_enabled !== "true") {
      throw new Error(`Expected public config to return "true" after re-enabling, got "${publicReenabledData.google_login_enabled}"`);
    }

    const reenabledGoogleRes = await fetch(`${baseUrl}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid_token_while_reenabled" }),
    });

    if (reenabledGoogleRes.status !== 201) {
      throw new Error(`Expected 201 after re-enabling Google Sign-In, got ${reenabledGoogleRes.status}`);
    }
    console.log("  ✓ Re-enabling Google Sign-In successfully restores authentication flow\n");

    // -------------------------------------------------------------------------
    // TEST 12: Admin toggle via PATCH /api/config/:key updates public value and sets is_public = 'true'
    // -------------------------------------------------------------------------
    console.log("[12/14] Testing admin toggle via PATCH /api/config/:key...");
    const testAdminId = "admin_test_" + crypto.randomBytes(6).toString("hex");
    const testSessionId = "sess_" + crypto.randomBytes(16).toString("hex");

    await db.insert(adminUsersTable).values({
      id: testAdminId,
      username: `admin_${crypto.randomBytes(4).toString("hex")}`,
      email: `admin_${crypto.randomBytes(4).toString("hex")}@example.com`,
      passwordHash: "dummyhash",
      role: "SUPER_ADMIN",
      isActive: true,
    });
    await db.insert(adminSessionsTable).values({
      id: testSessionId,
      adminUserId: testAdminId,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });

    // 12a. Toggle to "false" via admin PATCH
    const patchFalseRes = await fetch(`${baseUrl}/api/config/google_login_enabled`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${testSessionId}`,
      },
      body: JSON.stringify({ value: "false" }),
    });
    if (!patchFalseRes.ok) throw new Error(`PATCH /api/config/google_login_enabled failed with ${patchFalseRes.status}`);

    const [rowAfterPatchFalse] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "google_login_enabled"));

    if (rowAfterPatchFalse?.value !== "false" || rowAfterPatchFalse?.isPublic !== "true") {
      throw new Error(`Expected row after PATCH false to have value 'false' and isPublic 'true', got: ${JSON.stringify(rowAfterPatchFalse)}`);
    }

    const publicAfterPatchFalseRes = await fetch(`${baseUrl}/api/config/public`);
    const publicAfterPatchFalseData = await publicAfterPatchFalseRes.json();
    if (publicAfterPatchFalseData.google_login_enabled !== "false") {
      throw new Error(`Expected public config to return "false", got "${publicAfterPatchFalseData.google_login_enabled}"`);
    }

    // 12b. Toggle back to "true" via admin PATCH
    const patchTrueRes = await fetch(`${baseUrl}/api/config/google_login_enabled`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${testSessionId}`,
      },
      body: JSON.stringify({ value: "true" }),
    });
    if (!patchTrueRes.ok) throw new Error(`PATCH /api/config/google_login_enabled failed with ${patchTrueRes.status}`);

    const [rowAfterPatchTrue] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "google_login_enabled"));

    if (rowAfterPatchTrue?.value !== "true" || rowAfterPatchTrue?.isPublic !== "true") {
      throw new Error(`Expected row after PATCH true to have value 'true' and isPublic 'true', got: ${JSON.stringify(rowAfterPatchTrue)}`);
    }

    const publicAfterPatchTrueRes = await fetch(`${baseUrl}/api/config/public`);
    const publicAfterPatchTrueData = await publicAfterPatchTrueRes.json();
    if (publicAfterPatchTrueData.google_login_enabled !== "true") {
      throw new Error(`Expected public config to return "true", got "${publicAfterPatchTrueData.google_login_enabled}"`);
    }
    console.log("  ✓ Admin toggle via PATCH updates public endpoint and ensures is_public = 'true'\n");

    // -------------------------------------------------------------------------
    // TEST 13: Unrelated private config keys remain strictly private
    // -------------------------------------------------------------------------
    console.log("[13/14] Testing that unrelated private config keys remain private...");
    const privateKey = `test_private_key_${crypto.randomBytes(4).toString("hex")}`;
    await fetch(`${baseUrl}/api/config/${privateKey}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${testSessionId}`,
      },
      body: JSON.stringify({ value: "classified_private_data" }),
    });

    const pubResAfterPrivate = await fetch(`${baseUrl}/api/config/public`);
    const pubDataAfterPrivate = await pubResAfterPrivate.json();

    if (pubDataAfterPrivate[privateKey] !== undefined) {
      throw new Error(`Security breach: private config key "${privateKey}" leaked in public config!`);
    }

    // Also check secret keys (e.g. openai_api_key)
    if (pubDataAfterPrivate.openai_api_key !== undefined || pubDataAfterPrivate.gemini_api_key !== undefined) {
      throw new Error("Security breach: AI API keys leaked in public config!");
    }
    console.log("  ✓ Unrelated private config keys remain strictly excluded from /api/config/public\n");

    // -------------------------------------------------------------------------
    // TEST 14: ensureGoogleLoginConfig() repairs existing row without overwriting value
    // -------------------------------------------------------------------------
    console.log("[14/14] Testing ensureGoogleLoginConfig() repairs existing row without overwriting value...");
    // 14a. Test repair when value is "false" and isPublic was corrupted/set to "false"
    await db
      .update(appConfigTable)
      .set({ value: "false", isPublic: "false", updatedAt: new Date() })
      .where(eq(appConfigTable.key, "google_login_enabled"));

    // Run repair
    await ensureGoogleLoginConfig();

    const [repairedRowFalse] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "google_login_enabled"));

    if (repairedRowFalse.isPublic !== "true") {
      throw new Error(`ensureGoogleLoginConfig failed to repair isPublic to 'true', got: "${repairedRowFalse.isPublic}"`);
    }
    if (repairedRowFalse.value !== "false") {
      throw new Error(`ensureGoogleLoginConfig overwrote existing value 'false'! Got: "${repairedRowFalse.value}"`);
    }

    const publicAfterRepairFalseRes = await fetch(`${baseUrl}/api/config/public`);
    const publicAfterRepairFalseData = await publicAfterRepairFalseRes.json();
    if (publicAfterRepairFalseData.google_login_enabled !== "false") {
      throw new Error(`Expected public config to return "false" after repair, got "${publicAfterRepairFalseData.google_login_enabled}"`);
    }

    // 14b. Test repair when value is "true" and isPublic was corrupted/set to "false"
    await db
      .update(appConfigTable)
      .set({ value: "true", isPublic: "false", updatedAt: new Date() })
      .where(eq(appConfigTable.key, "google_login_enabled"));

    // Run repair
    await ensureGoogleLoginConfig();

    const [repairedRowTrue] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "google_login_enabled"));

    if (repairedRowTrue.isPublic !== "true") {
      throw new Error(`ensureGoogleLoginConfig failed to repair isPublic to 'true', got: "${repairedRowTrue.isPublic}"`);
    }
    if (repairedRowTrue.value !== "true") {
      throw new Error(`ensureGoogleLoginConfig overwrote existing value 'true'! Got: "${repairedRowTrue.value}"`);
    }

    const publicAfterRepairTrueRes = await fetch(`${baseUrl}/api/config/public`);
    const publicAfterRepairTrueData = await publicAfterRepairTrueRes.json();
    if (publicAfterRepairTrueData.google_login_enabled !== "true") {
      throw new Error(`Expected public config to return "true" after repair, got "${publicAfterRepairTrueData.google_login_enabled}"`);
    }
    console.log("  ✓ ensureGoogleLoginConfig repairs isPublic='true' without modifying existing enabled/disabled value\n");

    // Clean up test admin user & session
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, testSessionId));
    await db.delete(adminUsersTable).where(eq(adminUsersTable.id, testAdminId));

    console.log("========================================================");
    console.log("  ALL GOOGLE AUTH, CONFIG & REPAIR TESTS PASSED (14/14) ✓");
    console.log("========================================================\n");
  } finally {
    // Reset test verifier
    setCustomVerifierForTesting(null);
    server.close();
  }
}

runGoogleAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
  });
