#!/usr/bin/env bash
set -e

# Uploads the mock data set (go/tests/mocks) into a running l8physio deployment.
# Called by kind-start.sh once every pod is Ready; can also be re-run by hand
# against a fresh cluster. The target defaults to the KIND host port mapping.
ADDRESS="${L8PHYSIO_BASE_URL:-https://localhost:8088}"
SEED_USER="${L8PHYSIO_SEED_USER:-admin}"
SEED_PASS="${L8PHYSIO_SEED_PASS:-admin}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Waiting for ${ADDRESS} to answer..."
for i in $(seq 1 60); do
  if curl -sk -o /dev/null "${ADDRESS}/login.json"; then
    break
  fi
  sleep 2
done

# The web server serves static files at once but registers each service's
# endpoint only when that service announces itself, so a fresh deployment
# answers 404 on /physio/50/PhyTherapt (the seed's first write) for a while.
# Wait until it is registered rather than failing the whole seed on it.
echo "Waiting for the service endpoints to register..."
TOKEN=""
CODE=""
for i in $(seq 1 90); do
  TOKEN="$(curl -sk -X POST "${ADDRESS}/auth" -H 'Content-Type: application/json' \
    -d "{\"user\":\"${SEED_USER}\",\"pass\":\"${SEED_PASS}\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  if [ -n "$TOKEN" ]; then
    CODE="$(curl -sk -o /dev/null -w '%{http_code}' -G "${ADDRESS}/physio/50/PhyTherapt" \
      -H "Authorization: Bearer ${TOKEN}" --data-urlencode 'body={"text":"select * from PhysioTherapist limit 1 page 0"}')"
    [ "$CODE" != "404" ] && [ "$CODE" != "000" ] && break
  fi
  sleep 2
done
if [ "${CODE:-404}" = "404" ] || [ "${CODE:-000}" = "000" ]; then
  echo "error: ${ADDRESS}/physio/50/PhyTherapt never registered (last HTTP ${CODE:-none})" >&2
  exit 1
fi

echo "Uploading mock data to ${ADDRESS} as ${SEED_USER}..."
cd "${SCRIPT_DIR}/../go"
go run ./tests/mocks/cmd --address "${ADDRESS}" --user "${SEED_USER}" --password "${SEED_PASS}" --insecure
