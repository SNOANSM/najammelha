-- Hand-written to mirror lib/db/src/schema/najammelha.ts exactly.
-- Netlify Database applies migrations from this folder on deploy; it knows
-- nothing about Drizzle. `pnpm --filter @workspace/db run push` (drizzle-kit
-- push) is still the dev workflow against a Replit/local Postgres instance.
-- Any future change to najammelha.ts needs a matching new migration file
-- here to keep the Netlify-hosted database in sync.

CREATE TABLE najammelha_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE najammelha_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL
);

CREATE TABLE najammelha_reports (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  image TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  points INTEGER NOT NULL DEFAULT 10,
  support_count INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE najammelha_locations (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE najammelha_points (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_id INTEGER,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE najammelha_notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE najammelha_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE najammelha_rewards (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  discount_label TEXT NOT NULL,
  cost_points INTEGER NOT NULL,
  stock INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE najammelha_redemptions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  reward_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  cost_points INTEGER NOT NULL,
  reward_title TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  discount_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
