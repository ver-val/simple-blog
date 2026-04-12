SHELL := /bin/bash

.PHONY: test test-server test-client browser-test record-play-test keyword-test keyword-test-headless keyword-install coverage coverage-api coverage-ui coverage-server coverage-client lint lint-server lint-client quality quality-server

test:
	./scripts/test-all.sh

test-server:
	cd server && GOCACHE=$$(pwd)/.cache/go-build GOMODCACHE=$$(pwd)/.cache/go-mod go test ./...

test-client:
	cd client && npm test

browser-test:
	./scripts/test-ui.sh

record-play-test:
	npx selenium-side-runner -c "browserName=chrome goog:chromeOptions.args=[headless,no-sandbox,disable-dev-shm-usage]" tests/record-play/simple-blog.side

keyword-install:
	python3 -m pip install -r tests/keyword/requirements.txt

keyword-test:
	python3 -m robot -d tests/keyword/results tests/keyword/simple_blog.robot

keyword-test-headless:
	python3 -m robot -d tests/keyword/results -v BASE_URL:http://127.0.0.1:5173 -v BROWSER:headlesschrome tests/keyword/simple_blog.robot

coverage: coverage-server coverage-client

coverage-api: coverage-server

coverage-ui: coverage-client

coverage-server:
	cd server && GOCACHE=$$(pwd)/.cache/go-build GOMODCACHE=$$(pwd)/.cache/go-mod go test ./... -coverprofile=coverage.out && GOCACHE=$$(pwd)/.cache/go-build GOMODCACHE=$$(pwd)/.cache/go-mod go tool cover -func=coverage.out

coverage-client:
	cd client && npm run coverage

lint: lint-server lint-client

lint-server:
	./scripts/lint-server.sh

lint-client:
	cd client && npm run lint
