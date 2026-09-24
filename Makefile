.DEFAULT_GOAL := help

NPM ?= npm
BASE ?= /3d/

.PHONY: help install dev build build-pages preview preview-pages test test-file update-expected \
	lint lint-fix format format-check typecheck validate clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo
	@echo "  Variables: FIXTURE=<name part>  FILE=<test file>  BASE=$(BASE)"

node_modules: package.json package-lock.json
	$(NPM) ci
	@touch node_modules

install: node_modules ## Install dependencies (npm ci)

dev: node_modules ## Start the dev server at http://localhost:5173
	$(NPM) run dev

build: node_modules ## Type-check and build the static site into dist/
	$(NPM) run build

build-pages: node_modules ## Build for GitHub Pages (BASE=/3d/ by default)
	$(NPM) run build -- --base $(BASE)

preview: node_modules ## Serve the built site
	$(NPM) run preview

preview-pages: node_modules ## Serve the Pages build at http://localhost:4173/3d/
	$(NPM) run preview -- --base $(BASE)

test: node_modules ## Run all tests (filter fixtures with FIXTURE=<name part>)
	$(NPM) test

test-file: node_modules ## Run one test file: make test-file FILE=tests/runtime.test.ts
	@test -n "$(FILE)" || { echo "usage: make test-file FILE=tests/<name>.test.ts [FIXTURE=<name part>]"; exit 1; }
	npx vitest run $(FILE)

update-expected: node_modules ## Rewrite fixture expectations from the current code (FIXTURE=<name part> to limit)
	$(NPM) run update-expected

lint: node_modules ## Run ESLint
	$(NPM) run lint

lint-fix: node_modules ## Run ESLint with --fix
	$(NPM) run lint:fix

format: node_modules ## Apply ESLint fixes, then format with Prettier
	$(NPM) run format

format-check: node_modules ## Check formatting with Prettier
	$(NPM) run format:check

typecheck: node_modules ## Run the TypeScript compiler without emitting
	$(NPM) run typecheck

validate: node_modules ## Lint, format check, typecheck and test, as in CI
	$(NPM) run validate

clean: ## Remove dist/
	rm -rf dist
