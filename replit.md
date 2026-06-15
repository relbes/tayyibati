# طيباتي - Tayyibati

Arabic-first mobile app that checks food/ingredient compatibility with the Tayyibat dietary system. Users search foods, upload product images/labels; AI extracts ingredients, DB provides rulings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-configured in Replit)
- Required env: `OPENAI_API_KEY` — used by API server for ingredient extraction only
- Optional env: `RESEND_FROM_EMAIL` — sender for password-reset emails (e.g. `Tayyibati <noreply@yourdomain.com>`). Defaults to Resend's shared `onboarding@resend.dev`, which can ONLY deliver to the Resend account owner's own address until a domain is verified at resend.com/domains.

## Seeding the database

Use psql directly (scripts package cannot import `@workspace/db`):
```
PGPASSWORD=password psql -h helium -U postgres heliumdb -c "INSERT INTO foods ..."
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo ~54 + React Native 0.81.5 + Expo Router
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI gpt-4o-mini (ingredient extraction only)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — DB schema: `foods.ts`, `analysisHistory.ts`, `userUsage.ts`, `users.ts`, `passwordResets.ts`
- `artifacts/api-server/src/lib/email.ts` — password-reset email sender; `resendClient.ts` — Resend connector client (via `@replit/connectors-sdk` proxy)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/mobile/app/` — Expo Router screens
- `artifacts/mobile/context/` — AuthContext, AnalysisContext
- `artifacts/mobile/components/` — ScoreRing, IngredientChip, AnalysisResultCard, LoadingOverlay

## Architecture decisions

- **AI classifies every ingredient; DB is an override**: The Tayyibat system rules are embedded in the analysis prompt (`TAYYIBAT_SYSTEM` in `analysis.ts`). The AI extracts AND classifies every ingredient (allowed/forbidden/conditional/unknown) with a `frequency` (basic/daily/weekly/occasional) and Arabic reason. The `foods` table is an authoritative override: `applyDbOverride` rewrites status/reason for items whose normalized name exactly matches a curated DB row. `notFound` triggers ONLY when no food is detected at all (e.g. a non-food photo), never just because items aren't in the DB.
- **RTL first**: `I18nManager.forceRTL(true)` in `_layout.tsx`. All UI is Arabic-primary.
- **Auth is local**: User identity stored in AsyncStorage (no backend auth). Enables history/usage tracking without OAuth.
- **Freemium model**: 10 analyses/day free (tracked via `user_usage` table by `userId + date`). Premium flag stored as text "true"/"false" in DB.
- **Compatibility score**: 100 - penalties. Forbidden items cap score at 30. Conditional items subtract 30% per item of total.

## Product

- Home screen: database stats, quick actions
- Search screen: text input → AI extraction → DB lookup → compatibility score + ingredient breakdown
- Camera screen: image picker → AI vision → DB lookup (supports food photo + label OCR modes)
- History screen: saved analyses per user
- Profile screen: usage meter, premium upgrade prompt
- Admin screen: CRUD interface for the foods database
- Auth screen: simple email-based sign-in (local, no password). Includes "forgot password" → emailed 6-digit code → reset (`app/forgot-password.tsx`)
- Pricing screen: freemium / premium plan comparison

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## نشر التطبيق على Google Play Store

### المتطلبات الأساسية
1. **حساب Google Play Console** — رسوم تسجيل لمرة واحدة 25$: https://play.google.com/console
2. **EAS CLI** — أداة البناء السحابي من Expo:
   ```
   npm install -g eas-cli
   eas login
   ```
3. **إعداد مشروع EAS**: عدّل `extra.eas.projectId` في `artifacts/mobile/app.json` بعد تشغيل `eas init` داخل مجلد `artifacts/mobile/`.

### خطوات بناء ورفع APK / AAB

```bash
cd artifacts/mobile

# بناء APK للاختبار (internal testing)
eas build --platform android --profile preview

# بناء AAB لمتجر Google Play (الإصدار النهائي)
eas build --platform android --profile production
```

> ملاحظة: البناء يتم على سيرفرات Expo السحابية، لا يحتاج Java/Android SDK محلياً.

### ما يلزم قبل الرفع
| البند | الحالة | المطلوب |
|------|--------|---------|
| اسم الحزمة `package` | ✅ `com.tayyibati.app` | فريد في المتجر |
| رقم الإصدار `versionCode` | ✅ `1` | يزيد مع كل إصدار |
| أيقونة التطبيق | ✅ `icon.png` | 1024×1024 بكسل PNG بدون ألفا |
| Adaptive Icon | ✅ في `adaptiveIcon` | للأجهزة Android 8+ |
| صلاحيات الكاميرا | ✅ مشرحة بالعربية | مطلوبة من Google |
| سياسة الخصوصية | ❌ **مطلوب** | رابط URL على موقع أو صفحة |
| لقطات شاشة (screenshots) | ❌ **مطلوب** | 2+ لكل حجم شاشة |
| وصف التطبيق | ✅ في `app.json` | مكتوب |
| تقييم المحتوى | ❌ **مطلوب** | استبيان داخل Play Console |

### خطوات Play Console
1. افتح **Play Console → All apps → Create app**
2. أدخل اسم التطبيق: **طيباتي - Tayyibati**
3. اختر: Free، Arabic
4. أجب على استبيان تقييم المحتوى (Food & Drink app, no violence/adult content)
5. أضف سياسة الخصوصية URL (يمكن صفحة بسيطة على GitHub Pages أو Notion)
6. ارفع لقطات شاشة (Phone: 16:9 أو 9:16، الأبعاد الموصى بها: 1080×1920)
7. ارفع ملف AAB المُنتَج من `eas build`
8. أرسل للمراجعة (مدة المراجعة: 1-7 أيام)

### رفع إصدار جديد
```bash
# زد versionCode في app.json (+1 مثلاً من 1 إلى 2)
# أو استخدم autoIncrement في eas.json (مُفعّل تلقائياً في profile production)
eas build --platform android --profile production
eas submit --platform android --profile production
```

## Gotchas

- `expo-file-system` is NOT installed — camera uses `asset.base64` from `expo-image-picker` directly
- Foods stats route (`/foods/stats`) must be registered BEFORE `/foods/:id` in Express
- OpenAI model is `gpt-4o-mini` not `gpt-5-mini`
- Scripts package cannot import workspace-local packages via `@workspace/` — use psql for seeding
- DB `is_premium` column is text "true"/"false" not boolean (Drizzle ORM limitation with text column type)
- Password reset emails go through Resend via `@replit/connectors-sdk` (`connectors.proxy("resend", "/emails", ...)`). With the default `onboarding@resend.dev` sender, Resend returns 403 for any recipient except the account owner's verified email — set `RESEND_FROM_EMAIL` to a verified-domain address to email real users. In dev, if Resend is unreachable the reset code is logged (NODE_ENV !== production); in production an unconfigured provider throws.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for Expo-specific guidelines
