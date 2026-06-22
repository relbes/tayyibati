#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Rename legacy free_daily_limit config key to free_monthly_limit (idempotent)
PGPASSWORD="$PGPASSWORD" psql "$DATABASE_URL" -c "
  UPDATE app_config
  SET key = 'free_monthly_limit'
  WHERE key = 'free_daily_limit';
" 2>/dev/null || true
