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

- `lib/db/src/schema/` — DB schema: `foods.ts`, `analysisHistory.ts`, `userUsage.ts`
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/mobile/app/` — Expo Router screens
- `artifacts/mobile/context/` — AuthContext, AnalysisContext
- `artifacts/mobile/components/` — ScoreRing, IngredientChip, AnalysisResultCard, LoadingOverlay

## Architecture decisions

- **DB is source of truth**: All halal/haram rulings come from the `foods` table. OpenAI only extracts ingredient names.
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
- Auth screen: simple email-based sign-in (local, no password)
- Pricing screen: freemium / premium plan comparison

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `expo-file-system` is NOT installed — camera uses `asset.base64` from `expo-image-picker` directly
- Foods stats route (`/foods/stats`) must be registered BEFORE `/foods/:id` in Express
- OpenAI model is `gpt-4o-mini` not `gpt-5-mini`
- Scripts package cannot import workspace-local packages via `@workspace/` — use psql for seeding
- DB `is_premium` column is text "true"/"false" not boolean (Drizzle ORM limitation with text column type)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for Expo-specific guidelines
