-- OmniTrace PostgreSQL schema
-- Mirrors docs/database.md exactly.

-- Create database if it does not exist (run this separately as superuser if needed)
-- CREATE DATABASE omnidb;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- identity_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity_links (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  identifier_type  VARCHAR(50)  NOT NULL, -- email | phone | device_id | cookie_id | loyalty_id
  identifier_value VARCHAR(500) NOT NULL,
  confidence_score FLOAT        NOT NULL DEFAULT 1.0,
  linked_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_links_customer_id ON identity_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_type_value  ON identity_links(identifier_type, identifier_value);

-- ---------------------------------------------------------------------------
-- timeline_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timeline_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  channel           VARCHAR(20) NOT NULL,  -- web | mobile_app | call_center | in_person
  event_type        VARCHAR(100) NOT NULL, -- normalised vocabulary (see database.md)
  event_time        TIMESTAMPTZ  NOT NULL,
  is_escalation     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_dropoff        BOOLEAN      NOT NULL DEFAULT FALSE,
  resolution_status VARCHAR(20)  NOT NULL DEFAULT 'pending', -- resolved | unresolved | pending
  raw_event_ref     VARCHAR(255)           -- reference back to MongoDB _id
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_customer_id ON timeline_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_event_time   ON timeline_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_is_escalation ON timeline_events(is_escalation) WHERE is_escalation = TRUE;
CREATE INDEX IF NOT EXISTS idx_timeline_events_is_dropoff    ON timeline_events(is_dropoff)    WHERE is_dropoff = TRUE;

-- ---------------------------------------------------------------------------
-- analytics_flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  flag_type   VARCHAR(30) NOT NULL, -- dropoff | escalation | repeat_contact | churn_risk
  score       FLOAT       NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details     JSONB
);

CREATE INDEX IF NOT EXISTS idx_analytics_flags_customer_id ON analytics_flags(customer_id);
CREATE INDEX IF NOT EXISTS idx_analytics_flags_flag_type   ON analytics_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_analytics_flags_score_desc  ON analytics_flags(score DESC);
