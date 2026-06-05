#!/usr/bin/env bash
# Dump the physio postgres database to a timestamped SQL file.
# Run before any code change / deploy on prod.
#
# Restore: cat <file>.sql | docker exec -i unsecure-postgres \
#            psql -h 127.0.0.1 -U admin -d admin
#
# Env overrides: POSTGRES_CONTAINER, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_DIR

set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-unsecure-postgres}"
DB_USER="${PGUSER:-admin}"
DB_PASS="${PGPASSWORD:-admin}"
DB_NAME="${PGDATABASE:-admin}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backups}"

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
    echo "ERROR: postgres container '${CONTAINER}' is not running" >&2
    exit 1
fi

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/physio-${TIMESTAMP}.sql"
TMP="${OUT}.tmp"

echo "Dumping ${DB_NAME} from ${CONTAINER}..."
docker exec -e PGPASSWORD="${DB_PASS}" "${CONTAINER}" \
    pg_dump -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" \
            --clean --if-exists \
            --exclude-extension=timescaledb \
            --exclude-schema=_timescaledb_cache \
            --exclude-schema=_timescaledb_catalog \
            --exclude-schema=_timescaledb_config \
            --exclude-schema=_timescaledb_debug \
            --exclude-schema=_timescaledb_functions \
            --exclude-schema=_timescaledb_internal \
            --exclude-schema=timescaledb_experimental \
            --exclude-schema=timescaledb_information \
    > "${TMP}"
mv "${TMP}" "${OUT}"
ln -sf "$(basename "${OUT}")" "${BACKUP_DIR}/physio-latest.sql"

SIZE="$(du -h "${OUT}" | cut -f1)"
echo
echo "Wrote ${OUT}  (${SIZE})"
echo "Symlink: ${BACKUP_DIR}/physio-latest.sql -> $(basename "${OUT}")"
echo
echo "Row counts:"
docker exec -e PGPASSWORD="${DB_PASS}" "${CONTAINER}" \
    psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -c "
SELECT
  (SELECT count(*) FROM physioexercise) AS exercises,
  (SELECT count(*) FROM physioclient)   AS clients,
  (SELECT count(*) FROM treatmentplan)  AS plans,
  (SELECT count(*) FROM planexercise)   AS plan_exercises,
  (SELECT count(*) FROM physiotherapist) AS therapists;"

echo "Restore: cat ${OUT} | docker exec -i ${CONTAINER} psql -h 127.0.0.1 -U ${DB_USER} -d ${DB_NAME}"
