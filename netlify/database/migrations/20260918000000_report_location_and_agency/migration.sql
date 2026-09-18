-- Mirrors the new columns added to najammelha_reports in
-- lib/db/src/schema/najammelha.ts: whether the coordinates came from the
-- device GPS, and the agency the AI router suggested for the report.
ALTER TABLE najammelha_reports
  ADD COLUMN location_exact BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN agency_id TEXT,
  ADD COLUMN agency_name TEXT,
  ADD COLUMN agency_reason TEXT,
  ADD COLUMN agency_confidence REAL,
  ADD COLUMN agency_source TEXT;
