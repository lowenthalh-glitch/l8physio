-- Migrate PhysioClient.clientid from cli-NNN to email; preserve the old
-- cli-NNN value in the new alias column for login-by-alias during testing.
-- Cascades the rewrite to every column that references the old clientid.
--
-- Idempotent: a second run is a no-op because the WHERE clauses match nothing
-- after the first successful commit.
--
-- Apply with:
--   docker exec -i -e PGPASSWORD=admin unsecure-postgres \
--     psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U admin -d admin \
--     < go/migrations/001_email_as_clientid.sql

BEGIN;

ALTER TABLE physioclient ADD COLUMN IF NOT EXISTS alias text;

-- Snapshot the cli-NNN -> email mapping BEFORE any update. Rows without an
-- email are skipped (the new clientid must be non-empty).
CREATE TEMP TABLE _cli_to_email ON COMMIT DROP AS
  SELECT clientid AS old_id, email AS new_id
  FROM physioclient
  WHERE clientid LIKE 'cli-%' AND email <> '';

-- Rewrite child references (no DB-level FKs, just value rewrites).
UPDATE appointment        c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE exerciseswaplog    c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE generatedworkout   c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE homefeedback       c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE progresslog        c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE sessionreport      c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE statusoverridelog  c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE treatmentplan      c SET clientid       = m.new_id FROM _cli_to_email m WHERE c.clientid       = m.old_id;
UPDATE boostappcalendarevent c SET physioclientid = m.new_id FROM _cli_to_email m WHERE c.physioclientid = m.old_id;
UPDATE boostappparticipant   c SET physioclientid = m.new_id FROM _cli_to_email m WHERE c.physioclientid = m.old_id;

-- Migrate physioclient itself. Every SET expression evaluates against the
-- BEFORE-update row, so alias captures the old cli-NNN and reckey rewrites
-- correctly even though clientid is also being changed in the same statement.
UPDATE physioclient
SET alias    = clientid,
    reckey   = REPLACE(reckey, clientid, email),
    clientid = email
WHERE clientid LIKE 'cli-%' AND email <> '';

COMMIT;
