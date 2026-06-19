-- Enforce alias uniqueness for non-empty values.
-- Partial index: rows with NULL or '' alias are exempt (multiple clients may
-- exist without an alias). The first INSERT/UPDATE producing a duplicate
-- non-empty alias will fail with a unique-constraint violation, which the
-- write path surfaces to the UI as an error.
--
-- Doubles as a one-shot dupe check: applying this migration will fail if any
-- duplicate non-empty aliases already exist in physioclient.
--
-- Apply with:
--   docker exec -i -e PGPASSWORD=admin unsecure-postgres \
--     psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U admin -d admin \
--     < go/migrations/002_alias_unique.sql

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS physioclient_alias_unique
  ON physioclient (alias)
  WHERE alias IS NOT NULL AND alias <> '';

COMMIT;
