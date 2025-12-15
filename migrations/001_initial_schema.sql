-- Bron Web App Initial Schema
-- Based on PRD v0.1

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE run_status AS ENUM (
  'queued',
  'running',
  'needs_approval',
  'succeeded',
  'failed',
  'canceled'
);

CREATE TYPE run_event_type AS ENUM (
  'status',
  'message',
  'log',
  'tool',
  'ui',
  'artifact',
  'child_run'
);

CREATE TYPE message_role AS ENUM (
  'user',
  'assistant',
  'system',
  'tool'
);

CREATE TYPE oauth_provider AS ENUM (
  'google'
);

-- Brons table
CREATE TABLE brons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  system_prompt TEXT NOT NULL DEFAULT '',
  memory_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Runs table
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bron_id UUID NOT NULL REFERENCES brons(id) ON DELETE CASCADE,
  parent_run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status run_status NOT NULL DEFAULT 'queued',
  approval_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error JSONB
);

CREATE INDEX idx_runs_bron_id ON runs(bron_id);
CREATE INDEX idx_runs_parent_run_id ON runs(parent_run_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_created_at ON runs(created_at DESC);

-- Run events table
CREATE TABLE run_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  type run_event_type NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, seq)
);

CREATE INDEX idx_run_events_run_id_seq ON run_events(run_id, seq);

-- Bron messages table (canonical transcript)
CREATE TABLE bron_messages (
  id BIGSERIAL PRIMARY KEY,
  bron_id UUID NOT NULL REFERENCES brons(id) ON DELETE CASCADE,
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bron_messages_bron_id ON bron_messages(bron_id);
CREATE INDEX idx_bron_messages_run_id ON bron_messages(run_id);
CREATE INDEX idx_bron_messages_created_at ON bron_messages(created_at DESC);

-- Uploads table
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uploads_run_id ON uploads(run_id);

-- Artifacts table
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  blob_url TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_artifacts_run_id ON artifacts(run_id);

-- OAuth tokens table
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider oauth_provider NOT NULL,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, user_id)
);

CREATE INDEX idx_oauth_tokens_user_id ON oauth_tokens(user_id);

-- Trigger to update updated_at on brons
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_brons_updated_at
  BEFORE UPDATE ON brons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
