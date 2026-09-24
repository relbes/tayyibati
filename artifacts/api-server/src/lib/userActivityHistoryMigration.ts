/**
 * Safe Idempotent Migration for User Activity History Table
 *
 * Creates user_activity_history table and indexes.
 * Safely backfills real historical events from users and analysis_history.
 * Does not mutate or drop any existing tables.
 */

import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runUserActivityHistoryMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create user_activity_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        actor_type TEXT NOT NULL DEFAULT 'USER',
        actor_id TEXT,
        actor_name TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_activity_history_user_id_idx ON user_activity_history (user_id);
      CREATE INDEX IF NOT EXISTS user_activity_history_category_idx ON user_activity_history (category);
      CREATE INDEX IF NOT EXISTS user_activity_history_created_at_idx ON user_activity_history (created_at);
      CREATE INDEX IF NOT EXISTS user_activity_history_user_created_idx ON user_activity_history (user_id, created_at);
    `);

    // 3. Derive real historical account creation events for existing users
    await client.query(`
      INSERT INTO user_activity_history (user_id, category, event_type, event_name, description, actor_type, actor_id, metadata, created_at)
      SELECT
        u.id,
        'AUTH',
        'ACCOUNT_CREATED',
        'Account Created',
        CASE WHEN u.provider = 'google' THEN 'Account created with Google' ELSE 'Account created with Email' END,
        'USER',
        u.id,
        jsonb_build_object('provider', u.provider, 'email', u.email, 'source', 'historical_account_creation'),
        u.created_at
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM user_activity_history h
        WHERE h.user_id = u.id AND h.event_type = 'ACCOUNT_CREATED'
      );
    `);

    // 4. Derive real historical food searches & image analyses from existing analysis_history table
    await client.query(`
      INSERT INTO user_activity_history (user_id, category, event_type, event_name, description, actor_type, actor_id, metadata, created_at)
      SELECT
        a.user_id,
        CASE
          WHEN a.analysis_type = 'image' THEN 'IMAGE_ANALYSIS'
          WHEN a.analysis_type = 'label' THEN 'INGREDIENT_ANALYSIS'
          ELSE 'SEARCH'
        END,
        CASE
          WHEN a.analysis_type = 'image' THEN 'IMAGE_ANALYSIS'
          WHEN a.analysis_type = 'label' THEN 'LABEL_ANALYSIS'
          ELSE 'FOOD_SEARCH'
        END,
        CASE
          WHEN a.analysis_type = 'image' THEN 'Image Analysis'
          WHEN a.analysis_type = 'label' THEN 'Label Analysis'
          ELSE 'Food Search'
        END,
        COALESCE(NULLIF(a.query, ''), 'Analysis completed'),
        'USER',
        a.user_id,
        jsonb_build_object(
          'compatibilityScore', a.compatibility_score,
          'analysisType', a.analysis_type,
          'analysisHistoryId', a.id,
          'source', 'historical_analysis_record'
        ),
        a.created_at
      FROM analysis_history a
      WHERE a.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_activity_history h
          WHERE (h.metadata->>'analysisHistoryId')::int = a.id
        );
    `);

    await client.query("COMMIT");
    logger.info("User activity history migration & historical derivation completed successfully");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "Error running user activity history migration");
    throw err;
  } finally {
    client.release();
  }
}
