-- ============================================================
-- Phantom Analytics — PostgreSQL + TimescaleDB Schema
-- docker/init.sql
--
-- This script runs once on first container boot.
-- TimescaleDB-specific operations (hypertables, continuous
-- aggregates) are handled here since Prisma cannot manage them.
--
-- PRIVACY CONSTRAINTS:
--   - No raw IP addresses stored anywhere
--   - session_id is a non-reversible SHA-256 fingerprint hash
--   - No names, emails, or user-identifiable data
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid(), gen_random_bytes()

-- ── Users (Auth) ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    username       TEXT        NOT NULL UNIQUE,
    password_hash  TEXT        NOT NULL,
    display_name   TEXT        NOT NULL,
    role           TEXT        NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'developer', 'viewer')),
    totp_secret             TEXT,
    totp_enabled            BOOLEAN     NOT NULL DEFAULT false,
    backup_codes            JSONB,
    failed_login_attempts   INT         NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    password_reset_token    TEXT        UNIQUE,
    password_reset_expires  TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ── User-Site Access (viewer permissions) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS user_sites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sites_user ON user_sites (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sites_site ON user_sites (site_id);

-- ── Sites ────────────────────────────────────────────────────────────────
-- Each registered website gets a site record with a unique tracking token.

CREATE TABLE IF NOT EXISTS sites (
    id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name           TEXT        NOT NULL,
    domain         TEXT        NOT NULL UNIQUE,
    tracking_token TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    data_retention_days INT,              -- NULL = keep forever, min 7
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ          -- soft delete — data retained
);

-- Migration: add column if upgrading from older schema
ALTER TABLE sites ADD COLUMN IF NOT EXISTS data_retention_days INT;

CREATE INDEX IF NOT EXISTS idx_sites_token ON sites (tracking_token)
    WHERE deleted_at IS NULL;

-- ── Share Links ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS share_links (
    id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id    UUID        NOT NULL REFERENCES sites(id),
    token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    label      TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links (token);

-- ── Events (TimescaleDB hypertable) ─────────────────────────────────────
-- This is the core append-only event stream.
-- Partitioned by time via TimescaleDB for fast range queries.
--
-- Column notes:
--   session_id     — SHA-256 hash, never raw PII
--   country_code   — ISO 3166-1 alpha-2, server-side GeoIP
--   device_type    — parsed from UA, never raw UA string
--   custom_properties — JSONB for arbitrary event metadata

CREATE TABLE IF NOT EXISTS events (
    id                UUID        NOT NULL DEFAULT gen_random_uuid(),
    site_id           UUID        NOT NULL REFERENCES sites(id),
    session_id        TEXT        NOT NULL,  -- fingerprint hash
    event_type        TEXT        NOT NULL,  -- pageview|event|session_start|session_end|funnel_step
    url               TEXT        NOT NULL,
    referrer          TEXT,
    title             TEXT,

    -- Server-enriched geo (from GeoIP, no raw IP stored)
    country_code      CHAR(2),
    region            TEXT,

    -- Server-enriched device context (parsed from UA, no raw UA stored)
    device_type       TEXT,  -- 'desktop' | 'mobile' | 'tablet'
    browser           TEXT,
    os                TEXT,

    -- Client-reported context
    screen_width      INTEGER,
    screen_height     INTEGER,
    language          TEXT,
    timezone          TEXT,

    -- Custom event fields
    custom_name       TEXT,
    custom_properties JSONB,

    -- UTM parameters (client-reported, lowercase+trimmed)
    utm_source        VARCHAR(255),
    utm_medium        VARCHAR(255),
    utm_campaign      VARCHAR(255),

    -- Timing
    time_on_page      INTEGER,   -- seconds
    timestamp         TIMESTAMPTZ NOT NULL,

    CONSTRAINT events_event_type_check CHECK (
        event_type IN ('pageview', 'event', 'session_start', 'session_end', 'funnel_step', 'scroll', 'click')
    )
);

-- Convert events to a TimescaleDB hypertable, partitioned by timestamp.
-- chunk_time_interval of 7 days balances query performance and compression.
SELECT create_hypertable(
    'events',
    'timestamp',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Indexes optimized for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_events_site_time
    ON events (site_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_session
    ON events (session_id);

CREATE INDEX IF NOT EXISTS idx_events_site_url
    ON events (site_id, url);

CREATE INDEX IF NOT EXISTS idx_events_type_time
    ON events (site_id, event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_scroll_click
    ON events (site_id, event_type, timestamp DESC)
    WHERE event_type IN ('scroll', 'click');

CREATE INDEX IF NOT EXISTS idx_events_utm
    ON events (site_id, utm_source, utm_medium, utm_campaign, timestamp DESC)
    WHERE utm_source IS NOT NULL;

-- ── Sessions ─────────────────────────────────────────────────────────────
-- Aggregated session records built from the events stream.
-- Populated by the session aggregation pipeline (E7-F1).

CREATE TABLE IF NOT EXISTS sessions (
    id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id          UUID        NOT NULL REFERENCES sites(id),
    session_id       TEXT        NOT NULL,  -- same fingerprint hash as events
    entry_page       TEXT,
    exit_page        TEXT,
    page_count       INTEGER     NOT NULL DEFAULT 0,
    duration_seconds INTEGER     NOT NULL DEFAULT 0,
    is_bounce        BOOLEAN     NOT NULL DEFAULT FALSE,
    started_at       TIMESTAMPTZ NOT NULL,
    ended_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_site_time
    ON sessions (site_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id
    ON sessions (session_id);

ALTER TABLE sessions ADD CONSTRAINT IF NOT EXISTS sessions_site_session_unique UNIQUE (site_id, session_id);

-- ── Funnels ───────────────────────────────────────────────────────────────
-- Funnel definitions: ordered steps where each step is either a
-- page URL match or a custom event name.

CREATE TABLE IF NOT EXISTS funnels (
    id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id    UUID        NOT NULL REFERENCES sites(id),
    name       TEXT        NOT NULL,
    steps      JSONB       NOT NULL DEFAULT '[]',  -- FunnelStep[]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnels_site
    ON funnels (site_id);

-- ── Funnel Events ─────────────────────────────────────────────────────────
-- Tracks which funnel steps each session has completed.

CREATE TABLE IF NOT EXISTS funnel_events (
    id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    funnel_id    UUID        NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    session_id   TEXT        NOT NULL,
    step_index   INTEGER     NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel_step
    ON funnel_events (funnel_id, step_index);

CREATE INDEX IF NOT EXISTS idx_funnel_events_session
    ON funnel_events (session_id);

-- ============================================================
-- Continuous Aggregate Views
-- These are pre-computed materialized views that TimescaleDB
-- keeps up-to-date automatically via background jobs.
-- Use these for dashboard queries — NOT the raw events table.
-- ============================================================

-- ── Hourly pageviews rollup ───────────────────────────────────────────────
-- Used for: real-time dashboard, short date range (< 2 days) charts.

CREATE MATERIALIZED VIEW IF NOT EXISTS pageviews_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp)  AS bucket,
    site_id,
    COUNT(*)                           AS pageview_count,
    COUNT(DISTINCT session_id)         AS visitor_count
FROM events
WHERE event_type = 'pageview'
GROUP BY bucket, site_id
WITH NO DATA;

-- Refresh policy: keep hourly view within 1 hour of real time
SELECT add_continuous_aggregate_policy(
    'pageviews_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- ── Daily pageviews rollup ────────────────────────────────────────────────
-- Used for: historical charts (7d, 30d, 90d range queries).

CREATE MATERIALIZED VIEW IF NOT EXISTS pageviews_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp)   AS bucket,
    site_id,
    COUNT(*)                           AS pageview_count,
    COUNT(DISTINCT session_id)         AS visitor_count
FROM events
WHERE event_type = 'pageview'
GROUP BY bucket, site_id
WITH NO DATA;

-- Refresh policy: keep daily view within 1 day of real time
SELECT add_continuous_aggregate_policy(
    'pageviews_daily',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ============================================================
-- TimescaleDB Compression (optional — enable for production)
-- Reduces storage by 90%+ for data older than 7 days.
-- Uncomment in production deployments.
-- ============================================================

-- ALTER TABLE events SET (
--     timescaledb.compress,
--     timescaledb.compress_segmentby = 'site_id',
--     timescaledb.compress_orderby = 'timestamp DESC'
-- );
-- SELECT add_compression_policy('events', INTERVAL '7 days', if_not_exists => TRUE);

-- ============================================================
-- Seed: Insert a default site for development/testing
-- Tracking token is printed to logs for convenience.
-- ============================================================

DO $$
DECLARE
    dev_site_id UUID;
    dev_token   TEXT;
BEGIN
    INSERT INTO sites (name, domain)
    VALUES ('Local Dev Site', 'localhost')
    ON CONFLICT (domain) DO NOTHING
    RETURNING id, tracking_token INTO dev_site_id, dev_token;

    IF dev_site_id IS NOT NULL THEN
        RAISE NOTICE '================================================';
        RAISE NOTICE 'Dev site created!';
        RAISE NOTICE '  Site ID: %', dev_site_id;
        RAISE NOTICE '  Tracking Token: %', dev_token;
        RAISE NOTICE '================================================';
    END IF;
END $$;
