-- najammelha_uploads was never part of the Netlify schema. New uploads go to
-- Netlify Blobs, but photos carried over from the old Railway database live in
-- this table, and lib/uploads.ts falls back to it when a blob is missing.
CREATE TABLE IF NOT EXISTS najammelha_uploads (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
