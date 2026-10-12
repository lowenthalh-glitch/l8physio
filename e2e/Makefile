# l8physio E2E Test Makefile

.PHONY: help install test run kind

help:
	@echo "l8physio E2E Tests"
	@echo "=================="
	@echo "make install      - Install Playwright and dependencies"
	@echo "make test         - Run all E2E tests"
	@echo "make test:headed  - Run tests in headed mode"
	@echo "make test:ui      - Run tests with UI"
	@echo "make kind         - Deploy to KIND and run tests"
	@echo "make clean        - Cleanup"

install:
	npm install

test:
	npx playwright test

test:headed:
	npx playwright test --headed

test:ui:
	npx playwright test --ui

kind:
	@echo "Starting KIND cluster..."
	kind create cluster --name l8physio-e2e || exit 1
	@echo "Deploying services..."
	kubectl apply -f go/k8s/physio-kind.yaml
	kubectl apply -f go/physio/log-vnet/
	kubectl apply -f go/physio/log-agent/
	kubectl apply -f go/physio/boostapp/main/
	@echo "Waiting for pods..."
	kubectl wait --for=condition=Ready pod -l app=vnet --timeout=120s || exit 1
	@echo "Running tests against KIND cluster..."
	npx playwright test --base-url=http://localhost:$(kubectl get service physio-ui -o jsonpath='{.spec.ports[0].nodePort}')
	@echo "Cleaning up..."
	kind delete cluster --name l8physio-e2e

clean:
	rm -rf node_modules
	rm -f playwright-report.html
