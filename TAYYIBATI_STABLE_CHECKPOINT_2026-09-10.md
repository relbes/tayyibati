# Tayyibati Stable Version Restore Point

**Date**: 2026-09-10  
**Branch**: `redesign/mobile-theme`  
**Git Tag**: `tayyibati-stable-before-ui-fixes-2026-09-10`  
**Application ID / Package**: `com.tayyibati.app`  

---

## 1. Checkpoint Overview

This document defines the official, stable restore point for the **Tayyibati (طيباتي)** application prior to beginning the UI/interface improvement cycle. All components—Mobile App, Admin Dashboard, Backend API Server, Database schemas, Authentication, Subscriptions, AI & Food Analysis pipelines—are preserved in their verified working state.

---

## 2. Version & Build Status

| Component | Identifier / Version | Build / Validation Status |
| :--- | :--- | :--- |
| **Mobile App Version** | `1.0.2` (Expo SDK 54) | Verified (`npx expo config --type public` passed) |
| **Android Version Code** | `22` | Verified (`versionCode: 22`, `versionName: "1.0.2"`) |
| **Android Release AAB** | `artifacts/mobile/tayyibati-v22.aab` | Built & Manifest-inspected (EAS Build ID `560e7dd5-03ec-48c4-be2a-8386682480e3`) |
| **Mobile TypeScript** | `pnpm --filter mobile run typecheck` | Passed (0 errors) |
| **Admin Dashboard** | `artifacts/admin-dashboard` | Verified (`vite build` succeeded with 0 errors) |
| **Backend API Server** | `artifacts/api-server` | Verified (`node ./build.mjs` succeeded, 55+ bundles) |
| **Monorepo Manager** | `pnpm` (workspace) | Configured & operational |

---

## 3. Preserved Permissions & Features

### Android Permissions (Google Play Compliant)
- **Included / Functional**:
  - `android.permission.CAMERA` (Food & ingredient image analysis)
  - `android.permission.INTERNET` (API communication)
  - `android.permission.ACCESS_NETWORK_STATE` (Network connectivity checks)
  - `android.permission.ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
  - `android.permission.VIBRATE`
  - `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`
  - `com.tayyibati.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
- **Strictly Blocked / Absent (Google Play Photo/Video Picker Compliance)**:
  - `android.permission.READ_MEDIA_IMAGES`
  - `android.permission.READ_MEDIA_VIDEO`
  - `android.permission.READ_EXTERNAL_STORAGE`
  - `android.permission.WRITE_EXTERNAL_STORAGE`
  - `android.permission.RECORD_AUDIO`

### Core Integrations & Business Logic
1. **Authentication**:
   - Google Sign-In (Web & Android Client IDs configured)
   - Custom Email/Password & Guest session flows
   - Admin session authentication & CORS protection
2. **Monetization / Subscriptions**:
   - RevenueCat SDK (Android, iOS, Test API keys configured)
   - Premium feature gating & receipt validation
3. **AI & Food Analysis**:
   - OpenAI integration for food compatibility analysis under the Tayyibati nutritional system
   - Image capture & cropping pipeline (`expo-image-picker`, `expo-image-manipulator`)
   - Food database search and classification (Allowed / Prohibited / Caution)
4. **Admin Dashboard**:
   - Contact requests management, user management, food database management, analytics charts
   - Password change & authenticated administrative controls

---

## 4. Environment & Configuration Structure

- **Backend `.env`**:
  - `PORT=5000`
  - `DATABASE_URL`: PostgreSQL connection string
  - `OPENAI_API_KEY`: Configured OpenAI API key
  - `ALLOWED_ORIGINS`: Configured origins for CORS
  - `SESSION_SECRET`: Session encryption secret
  - `ADMIN_PASSWORD`: Admin authentication credential
  - `RESEND_API_KEY` & `RESEND_FROM_EMAIL`: Transactional email service
  - `GOOGLE_CLIENT_ID_WEB` & `GOOGLE_CLIENT_ID_ANDROID`: OAuth client IDs

- **Mobile `artifacts/mobile/.env`**:
  - `EXPO_PUBLIC_DOMAIN`: API backend URL (`http://127.0.0.1:5000`)
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
  - `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`
  - `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID`

---

## 5. Known Existing Notes

1. **Local vs Cloud Android Build**:
   - Local Gradle/CMake native C++ compilation on Windows encounters long path / toolchain issues with React Native 0.76. EAS Cloud Build (`npx eas build --platform android --profile production`) is the verified, reliable build pathway.
2. **Library Monorepo Typecheck**:
   - `lib/api-client-react/src/custom-fetch.ts` has existing legacy variable references from previous admin auth refactoring.
   - Root `pnpm run typecheck:libs` fails on this file, but individual application builds (`mobile` typecheck, `admin-dashboard` vite build, `api-server` esbuild) all build and bundle cleanly without errors.

---

## 6. How to Restore to This Exact Checkpoint

If any subsequent UI change, refactor, or experiment causes regressions, use the following commands to return cleanly to this state:

### Step 1: Discard any uncommitted working changes
```bash
git reset --hard HEAD
git clean -fd
```

### Step 2: Checkout the stable tag
```bash
git checkout tayyibati-stable-before-ui-fixes-2026-09-10
```

### Step 3: (Optional) Re-create a new branch from this safety point
```bash
git checkout -b restore/tayyibati-stable-2026-09-10
```

### Step 4: Verify mobile configuration & builds
```bash
cd artifacts/mobile
npx expo config --type public
cd ../..
pnpm --filter admin-dashboard run build
pnpm --filter api-server run build
```
