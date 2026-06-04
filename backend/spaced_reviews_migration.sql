-- Spaced Repetition reviews schema migration for Supabase SQL Editor

CREATE TABLE IF NOT EXISTS spaced_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  easiness_factor FLOAT DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  repetition_count INT DEFAULT 0,
  next_review_date TIMESTAMPTZ NOT NULL,
  last_reviewed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index session_id for fast queries
CREATE INDEX IF NOT EXISTS idx_spaced_reviews_session ON spaced_reviews(session_id);
-- Unique index to prevent duplicate schedules for the same session + concept
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaced_reviews_session_concept ON spaced_reviews(session_id, concept_id);
