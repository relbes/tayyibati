/**
 * Safe Migration for AI Monitoring Tables
 *
 * Creates ai_api_usage, ai_provider_status, ai_alert_settings, and ai_alert_events
 * idempotently without disrupting any existing database tables or data.
 */

import { pool } from "@workspace/db";

export async function runAiMonitoringMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. ai_api_usage
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_api_usage (
        id SERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        chain_id TEXT NOT NULL,
        parent_request_id TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        feature TEXT NOT NULL,
        request_status TEXT NOT NULL,
        http_status INTEGER,
        error_code TEXT,
        error_message TEXT,
        latency_ms INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        tokens_available BOOLEAN NOT NULL DEFAULT true,
        estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
        is_fallback BOOLEAN NOT NULL DEFAULT false,
        fallback_reason TEXT,
        chain_final_status TEXT NOT NULL DEFAULT 'SUCCESS',
        metadata JSONB
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_api_usage_request_id_idx ON ai_api_usage (request_id);
      CREATE INDEX IF NOT EXISTS ai_api_usage_timestamp_idx ON ai_api_usage (timestamp);
      CREATE INDEX IF NOT EXISTS ai_api_usage_provider_idx ON ai_api_usage (provider);
      CREATE INDEX IF NOT EXISTS ai_api_usage_feature_idx ON ai_api_usage (feature);
      CREATE INDEX IF NOT EXISTS ai_api_usage_request_status_idx ON ai_api_usage (request_status);
      CREATE INDEX IF NOT EXISTS ai_api_usage_chain_id_idx ON ai_api_usage (chain_id);
    `);

    // 2. ai_provider_status
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_provider_status (
        provider TEXT PRIMARY KEY,
        is_configured BOOLEAN NOT NULL DEFAULT false,
        operational_status TEXT NOT NULL DEFAULT 'HEALTHY',
        connectivity_status TEXT NOT NULL DEFAULT 'UNCHECKED',
        connectivity_last_checked_at TIMESTAMPTZ,
        connectivity_latency_ms INTEGER,
        last_successful_call_at TIMESTAMPTZ,
        last_failed_call_at TIMESTAMPTZ,
        last_error_code TEXT,
        last_error_message TEXT,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        balance_status TEXT NOT NULL DEFAULT 'UNAVAILABLE_VIA_API',
        balance_amount DOUBLE PRECISION,
        balance_currency TEXT DEFAULT 'USD',
        balance_last_checked_at TIMESTAMPTZ,
        billing_dashboard_url TEXT NOT NULL,
        daily_spend_limit DOUBLE PRECISION,
        monthly_spend_limit DOUBLE PRECISION,
        today_estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
        month_estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
        all_time_estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Seed default provider status rows if missing
    await client.query(`
      INSERT INTO ai_provider_status (provider, is_configured, operational_status, connectivity_status, billing_dashboard_url, daily_spend_limit, monthly_spend_limit)
      VALUES
        ('openai', false, 'HEALTHY', 'UNCHECKED', 'https://platform.openai.com/usage', 10.0, 100.0),
        ('gemini', false, 'HEALTHY', 'UNCHECKED', 'https://console.cloud.google.com/billing', 10.0, 100.0)
      ON CONFLICT (provider) DO NOTHING;
    `);

    // 3. ai_alert_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_alert_settings (
        id SERIAL PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT true,
        alert_email TEXT NOT NULL DEFAULT '',
        openai_daily_spend_warning DOUBLE PRECISION NOT NULL DEFAULT 5.0,
        openai_daily_spend_critical DOUBLE PRECISION NOT NULL DEFAULT 10.0,
        openai_monthly_spend_warning DOUBLE PRECISION NOT NULL DEFAULT 50.0,
        openai_monthly_spend_critical DOUBLE PRECISION NOT NULL DEFAULT 100.0,
        gemini_daily_spend_warning DOUBLE PRECISION NOT NULL DEFAULT 5.0,
        gemini_daily_spend_critical DOUBLE PRECISION NOT NULL DEFAULT 10.0,
        gemini_monthly_spend_warning DOUBLE PRECISION NOT NULL DEFAULT 50.0,
        gemini_monthly_spend_critical DOUBLE PRECISION NOT NULL DEFAULT 100.0,
        alert_on_quota_exhaustion BOOLEAN NOT NULL DEFAULT true,
        alert_on_billing_failure BOOLEAN NOT NULL DEFAULT true,
        alert_on_repeated_failures BOOLEAN NOT NULL DEFAULT true,
        consecutive_failure_threshold INTEGER NOT NULL DEFAULT 3,
        cooldown_minutes INTEGER NOT NULL DEFAULT 60,
        send_recovery_email BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Seed default alert settings row if missing
    await client.query(`
      INSERT INTO ai_alert_settings (id, enabled, alert_email)
      VALUES (1, true, '')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. ai_alert_events
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_alert_events (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_to TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS ai_alert_events_provider_type_idx ON ai_alert_events (provider, alert_type);
      CREATE INDEX IF NOT EXISTS ai_alert_events_created_at_idx ON ai_alert_events (created_at);
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
