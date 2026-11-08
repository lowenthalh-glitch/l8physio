#!/usr/bin/env bash
# Make sure the TestLLM credential in the cluster matches the l8secure phy plugin (llm.test-llm.dev, public
# Let's Encrypt certificate, so no custom CA is needed). Adds it when missing, updates it when it differs.
#   ./scripts/llm-setup.sh
#   PHY_JSON=<path>   plugin file holding credentials.TestLLM (l8secure phy plugin)
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost:8088}"
PHY_JSON="${PHY_JSON:-$HOME/proj/src/github.com/saichler/l8secure/go/secure/plugin/phy/phy.json}"

curl -sf -m 8 -o /dev/null https://llm.test-llm.dev/health || { echo "llm.test-llm.dev unreachable" >&2; exit 1; }

# 0. the web server answers once the cluster is fully up (fresh clusters take a while)
for i in $(seq 1 60); do
  code="$(curl -sk -m 5 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    -d '{"user":"admin","pass":"admin"}' "$BASE_URL/physio-auth" || true)"
  [ "$code" = 200 ] && break
  [ "$i" = 60 ] && { echo "web server at $BASE_URL not ready (last status $code)" >&2; exit 1; }
  sleep 5
done

# 1. credential (idempotent: only posted when missing)
BASE_URL="$BASE_URL" PHY_JSON="$PHY_JSON" python3 - <<'PY'
import json, os, ssl, urllib.parse, urllib.request
base, ctx = os.environ["BASE_URL"], ssl._create_unverified_context()
def call(path, data=None, tok=None, method=None, q=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    url = base + path + ("?body=" + urllib.parse.quote(json.dumps(q)) if q else "")
    body = json.dumps(data).encode() if data is not None else None
    return urllib.request.urlopen(urllib.request.Request(url, body, h, method=method), context=ctx, timeout=30).read().decode()
tok = json.loads(call("/physio-auth", {"user": "admin", "pass": "admin"}))["token"]
have = json.loads(call("/physio/75/Creds", tok=tok, method="GET", q={"text": "select * from L8Credentials"})).get("list", [])
want = json.load(open(os.environ["PHY_JSON"]))["credentials"]["TestLLM"]
cur = next((c for c in have if c.get("id") == "TestLLM"), None)
if cur is None:
    call("/physio/75/Creds", want, tok, "POST"); print("TestLLM credential added")
elif cur.get("creds") != want["creds"]:
    call("/physio/75/Creds", {**cur, "creds": want["creds"]}, tok, "PUT"); print("TestLLM credential updated")
else:
    print("TestLLM credential up to date")
PY
