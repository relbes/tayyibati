---
name: Tayyibati App Architecture
description: Key architectural decisions and gotchas for the Tayyibati Expo + Express app.
---

## Core rule
OpenAI (`gpt-4o-mini`) is used ONLY for ingredient extraction from text/images. All halal/haram rulings come from the `foods` DB table — never from AI.

## Seeding the DB
`scripts` package cannot import `@workspace/db` (it's not in npm registry, only workspace-local). Seed via `psql` directly:
```
PGPASSWORD=password psql -h helium -U postgres heliumdb -c "INSERT INTO foods ..."
```

## Database
- `foods` table: `name_ar`, `name_en`, `category`, `status` (allowed/forbidden/conditional), `reason`, `notes`
- `analysis_history` table: `user_id`, `query`, `analysis_type`, `compatibility_score`, `report` (jsonb)
- `user_usage` table: `user_id`, `date` (YYYY-MM-DD string), `count`, `is_premium` (text "true"/"false")
- Free daily limit: 10 analyses/day

## Mobile
- RTL forced via `I18nManager.forceRTL(true)` in `_layout.tsx`
- Auth is localStorage-only (no real backend auth) — `context/AuthContext.tsx`
- `expo-file-system` NOT installed — camera screen uses `asset.base64` from ImagePicker directly
- Fonts: Inter family loaded via `@expo-google-fonts/inter`

## API
- All routes under `/api` prefix
- Analysis routes: `POST /api/analysis/text`, `POST /api/analysis/image`
- Foods stats route must be registered BEFORE `/foods/:id` to avoid path collision
- OpenAI model: `gpt-4o-mini` (not `gpt-5-mini` which doesn't exist)

**Why:** These are non-obvious constraints that caused bugs/confusion during initial build.
