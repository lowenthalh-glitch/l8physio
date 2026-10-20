# l8physio E2E (Playwright vs KIND)
.PHONY: help install up test test-api test-desktop test-mobile test-kind patch down clean zzz-check

help:
	@echo "make install        - npm install + chromium"
	@echo "make up             - create KIND cluster, load images, deploy"
	@echo "make test           - run the whole suite (api, desktop, mobile, kind)"
	@echo "make test-api|test-desktop|test-mobile|test-kind"
	@echo "make patch APPS='physio-web physio' - reload rebuilt images + restart pods"
	@echo "make down           - delete the cluster"

install:
	npm install
	npx playwright install chromium

up:
	./scripts/kind-e2e.sh up

test:
	./scripts/kind-e2e.sh test

test-api:
	npx playwright test --project=api
test-desktop:
	npx playwright test --project=desktop
test-mobile:
	npx playwright test --project=mobile
test-kind:
	npx playwright test --project=kind

patch:
	./scripts/kind-e2e.sh patch $(APPS)

down:
	./scripts/kind-e2e.sh down

# PostImplementationE2ETesting: debug specs (zzz-*) must never be committed
zzz-check:
	@test -z "$$(find tests -name 'zzz-*')" || (echo "remove zzz-* specs"; exit 1)

clean:
	rm -rf node_modules playwright-report test-results
