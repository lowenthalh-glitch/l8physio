# l8physio E2E

Playwright end-to-end tests that run against the real stack in a local KIND cluster
(vnet, physio services, web server with the desktop and mobile UIs, boostapp, log agent).

## Projects

| project | directory | covers |
|---|---|---|
| `api` | `tests/api` | REST/auth: login, CRUD per service, validation callbacks, security, system services |
| `desktop` | `tests/desktop` | desktop UI (`/app.html`): login, navigation, CRUD popups, tables, portals, system section |
| `mobile` | `tests/mobile` | mobile bundle (`/m/app.html`, Pixel 7 profile) |
| `kind` | `tests/kind` | cluster health: pods, images, volumes, services, restart and persistence |

Shared code: `fixtures/` (API client, auth, seed data, kubectl helpers, service table) and `pages/` (page objects).
Specs run serially on one worker because they share a live database.

## Prerequisites

`docker`, `kind`, `kubectl`, Node 20+. Images `saichler/physio*:latest` must exist locally (see below).

```
make install     # npm install + chromium
make up          # create the KIND cluster, load local images, deploy, set up the agent LLM (make llm)
```

The web server is reachable at `https://localhost:8088` (self-signed TLS, NodePort 30080 mapped to the host).

## Running

```
make test                              # whole suite
make test-api | test-desktop | test-mobile | test-kind
npx playwright test --project=desktop tests/desktop/system.spec.ts
npx playwright test --project=api -g "login"
make down                              # delete the cluster
```

Run the projects one after another, not at the same time. Write output to a file
(`--reporter=list > out.log`) rather than piping through `tail`. Failures keep a screenshot, video and
trace in `test-results/`; `npm run report` opens the HTML report.

| variable | default | meaning |
|---|---|---|
| `BASE_URL` | `https://localhost:8088` | web server under test |
| `E2E_USER` / `E2E_PASS` | `admin` / `admin` | login used by the fixtures |
| `KIND_CLUSTER` | `l8physio-e2e` | cluster name |
| `KIND_NAMESPACE` | `physio` | namespace |

## Fix loop: rebuild and patch

The project Dockerfiles fetch Go source from GitHub (`GOPROXY=direct`), so push before building. Web assets
come from the working tree. Build locally with `docker build` (the `build.sh` scripts push to Docker Hub):

```
cd go/physio/main && docker build --no-cache -t saichler/physio:latest .
cd e2e && make patch APPS='physio'            # kind load + restart the pod
kubectl -n physio delete pod physio-web-0     # always restart web last, then wait ~30s
```

Image names per app: `physio`, `physio-vnet`, `physio-web`, `physio-log-vnet`, `physio-log-agent`, `physio-boostapp`.
After patching vnet or physio, restart in the order vnet, physio and boostapp, then web. If the web server
answers 404 or "Cannot find active handler", it was restarted too early. Recreate with
`k8s/kind-stop.sh && k8s/kind-start.sh` as a last resort.

## AI agent LLM

`tests/api/agent.spec.ts` needs a reachable LLM. `make llm` (`scripts/llm-setup.sh`) adds the `TestLLM` credential to the
cluster if missing (read from the l8secure phy plugin, `PHY_JSON`) and picks the address for `llm.test-llm.dev`:
public DNS when it answers, otherwise the LAN address `LLM_LAN_IP` (default `192.168.1.121`) as a hostAlias on `physio-0`.
Force a choice with `LLM_MODE=public|lan`.

## Writing tests

- Create data through `seed` (`fixtures/data.ts`) and use `token()` for unique, punctuation-free values
  (L8QL values must not contain punctuation). `seed` cleans up after the test.
- Seeded clients, plans and therapists may get an `xN` suffix on their name: the helper retries until the
  generated id starts with a letter (l8ui's form collector calls `parseInt()` on reference ids). Assert on the
  returned record, not on the token you passed in.
- The data accumulates between runs, so find rows with the table filter instead of assuming page 1.
- Debug specs named `zzz-*` must not be committed (`make zzz-check`).

## Known failure

`tests/api/services.spec.ts` "Events (76) and Notify (78) are active" fails until `go/go.mod` pins an l8common
that includes `go/system` and adds l8notify, and `go/physio/main/main.go` activates them with `system.Activate`.
