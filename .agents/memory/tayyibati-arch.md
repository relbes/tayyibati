---
name: Tayyibati App Architecture
description: Key architectural decisions and gotchas for the Tayyibati Expo + Express app.
---

## Core rule (changed June 2026)
OpenAI (`gpt-4o-mini`) both extracts AND classifies every ingredient against the embedded Tayyibat rulebook (`TAYYIBAT_SYSTEM` constant in `analysis.ts`): natural/طيّب = allowed, processed/modified = forbidden. Each item gets a `status` + `frequency` (basic/daily/weekly/occasional) + Arabic `reason`. The `foods` DB table is an authoritative OVERRIDE only — `applyDbOverride` rewrites status/reason for exact normalized-name matches. `notFound` fires ONLY when no food is detected at all (non-food photo/query), never because items are missing from the DB.
**Why:** the old "DB is source of truth, AI extracts names only" design returned "لم يُعثر على نتائج" for any ingredient outside the tiny ~88-item DB — useless for real meal photos. Users want every ingredient classified by the book's principle, not gated on DB membership.

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
