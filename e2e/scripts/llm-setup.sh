#!/usr/bin/env bash
# Point the physio pod at the test LLM and make sure the TestLLM credential exists.
#   ./scripts/llm-setup.sh
# The LLM host (default llm.test-llm.dev) resolves to a public IP that is often unreachable from
# the LAN. If the host answers on its public address nothing is pinned; otherwise it is pinned to
# LLM_LAN_IP via a hostAlias on the physio pod. Override with:
#   LLM_LAN_IP=192.168.1.121   LAN address of the LLM server
#   LLM_HOST=llm.test-llm.dev  host name used by the credential
#   LLM_MODE=auto|public|lan   force a choice (default auto)
#   PHY_JSON=<path>            plugin file holding credentials.TestLLM (l8secure phy plugin)
set -euo pipefail

CLUSTER="${KIND_CLUSTER:-l8physio-e2e}"
NS="${KIND_NAMESPACE:-physio}"
CTX="kind-${CLUSTER}"
BASE_URL="${BASE_URL:-https://localhost:8088}"
LLM_HOST="${LLM_HOST:-llm.test-llm.dev}"
LLM_LAN_IP="${LLM_LAN_IP:-192.168.1.121}"
LLM_MODE="${LLM_MODE:-auto}"
PHY_JSON="${PHY_JSON:-$HOME/proj/src/github.com/saichler/l8secure/go/secure/plugin/phy/phy.json}"
K="kubectl --context $CTX -n $NS"

reachable() { # reachable [ip]  -> any HTTP answer (even 401) counts
  local resolve=()
  [ -n "${1:-}" ] && resolve=(--resolve "$LLM_HOST:443:$1")
  curl -sk -m 5 "${resolve[@]}" -o /dev/null "https://$LLM_HOST/v1/models"
}

mode="$LLM_MODE"
if [ "$mode" = auto ]; then
  if reachable; then mode=public
  elif reachable "$LLM_LAN_IP"; then mode=lan
  else echo "LLM host unreachable on public DNS and on $LLM_LAN_IP" >&2; exit 1; fi
fi

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
if any(c.get("id") == "TestLLM" for c in have):
    print("TestLLM credential present")
else:
    call("/physio/75/Creds", json.load(open(os.environ["PHY_JSON"]))["credentials"]["TestLLM"], tok, "POST")
    print("TestLLM credential added")
PY

# 2. host alias on the physio pod, only when it changes
current="$($K get statefulset physio -o jsonpath='{.spec.template.spec.hostAliases[0].ip}')"
want=""; [ "$mode" = lan ] && want="$LLM_LAN_IP"
if [ "$current" = "$want" ]; then
  echo "physio hostAlias already '$want' (mode $mode)"
else
  if [ -n "$want" ]; then
    $K patch statefulset physio --type=merge -p "{\"spec\":{\"template\":{\"spec\":{\"hostAliases\":[{\"ip\":\"$want\",\"hostnames\":[\"$LLM_HOST\"]}]}}}}"
  else
    $K patch statefulset physio --type=json -p '[{"op":"remove","path":"/spec/template/spec/hostAliases"}]'
  fi
  $K rollout status statefulset/physio --timeout=180s
  echo "physio now uses ${want:-public DNS} for $LLM_HOST (mode $mode)"
fi
