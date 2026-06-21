-- Migration 0001: initial schema
-- Run: wrangler d1 migrations apply phylo-db

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  username    TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  country     TEXT,
  wins        INTEGER NOT NULL DEFAULT 0,
  losses      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TABLE IF NOT EXISTS scans (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_score    REAL NOT NULL,
  category_scores  TEXT NOT NULL,
  ai_feedback      TEXT NOT NULL,
  battle_id        TEXT,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_scans_user   ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_battle ON scans(battle_id);

CREATE TABLE IF NOT EXISTS battles (
  id                     TEXT PRIMARY KEY,
  user_a_id              TEXT NOT NULL REFERENCES users(id),
  user_b_id              TEXT NOT NULL REFERENCES users(id),
  user_a_score           REAL,
  user_b_score           REAL,
  user_a_category_scores TEXT,
  user_b_category_scores TEXT,
  winner_id              TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending',
  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at           INTEGER
);

CREATE INDEX IF NOT EXISTS idx_battles_user_a ON battles(user_a_id);
CREATE INDEX IF NOT EXISTS idx_battles_user_b ON battles(user_b_id);

CREATE TABLE IF NOT EXISTS daily_scan_usage (
  user_id    TEXT NOT NULL,
  date       TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
