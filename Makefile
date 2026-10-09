# Entry point for the whole pokebattle stack.
# Node apps (web, battle-engine) run on the host through pnpm/Turborepo;
# PostgreSQL databases and the Symfony user API run in Docker.
# Run `make` to list the available targets.

SHELL := /bin/bash
.DEFAULT_GOAL := help

ENGINE_DIR := apps/battle-engine
API_DIR := apps/user-api
API_COMPOSE := cd $(API_DIR) && docker compose
API_EXEC := $(API_COMPOSE) exec -T php
API_PROD_IMAGE := pokebattle-user-api-prod-check

.PHONY: help setup install env-files dev up down ps logs db-logs \
	lint format typecheck build test audit ci \
	db-up db-down db-generate db-migrate db-import \
	api-build api-up api-down api-jwt api-test-db api-migrate api-test \
	api-lint api-format api-check api-prod-image api-shell api-console

help: ## List the available targets
	@awk 'BEGIN {FS = ":.*## "} /^## / {printf "\n\033[1m%s\033[0m\n", substr($$0, 4)} /^[a-z-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Setup

setup: install env-files api-build up api-jwt api-test-db ## First install: dependencies, local env files, images, JWT keys, test database

install: ## Install Node dependencies (PHP dependencies are installed by the API container)
	pnpm install

env-files: ## Create local env files with random secrets, keeping existing ones
	@if [ ! -f $(ENGINE_DIR)/.env ]; then \
		sed "s/change-me/$$(openssl rand -hex 16)/g" $(ENGINE_DIR)/.env.example > $(ENGINE_DIR)/.env; \
		echo "Created $(ENGINE_DIR)/.env"; \
	fi
	@if ! grep -qs '^JWT_PASSPHRASE=.' $(API_DIR)/.env.local; then \
		printf 'JWT_PASSPHRASE=%s\n' "$$(openssl rand -hex 32)" >> $(API_DIR)/.env.local; \
		echo "Added JWT_PASSPHRASE to $(API_DIR)/.env.local"; \
	fi

## Run

dev: up ## Start the whole stack: containers in the background, then web + battle-engine in watch mode
	pnpm dev

up: db-up api-up ## Start all containers (battle-engine database, user API and its database)

down: db-down api-down ## Stop all containers (data volumes are kept)

ps: ## Show the containers status
	@cd $(ENGINE_DIR) && docker compose ps
	@$(API_COMPOSE) ps

logs: ## Follow the user API logs
	$(API_COMPOSE) logs -f

db-logs: ## Follow the battle-engine database logs
	cd $(ENGINE_DIR) && docker compose logs -f

## Quality

lint: api-lint ## Lint everything: Biome, PHP-CS-Fixer and PHPStan
	pnpm lint

format: api-format ## Format everything: Biome and PHP-CS-Fixer
	pnpm format

typecheck: ## Type-check the TypeScript packages
	pnpm typecheck

build: ## Build the TypeScript packages
	pnpm build

test: up api-test ## Run every test suite (starts the containers they need)
	pnpm test

audit: ## Audit Node and PHP dependencies for known vulnerabilities
	pnpm audit --prod --audit-level high
	$(API_EXEC) composer audit

ci: up lint typecheck build test api-check audit api-prod-image ## Run the same checks as the CI

## Battle engine database

db-up: ## Start the battle-engine database
	pnpm db:up

db-down: ## Stop the battle-engine database
	pnpm db:down

db-generate: ## Generate a Drizzle migration from the schema
	pnpm --filter @pokebattle/battle-engine db:generate

db-migrate: ## Apply the Drizzle migrations
	pnpm --filter @pokebattle/battle-engine db:migrate

db-import: ## Import the PokeAPI battle data (replaces the previous import)
	pnpm --filter @pokebattle/battle-engine db:import

## User API (Symfony)

api-build: ## Build the user API images
	$(API_COMPOSE) build --pull

api-up: ## Start the user API and its database
	pnpm api:up

api-down: ## Stop the user API and its database
	pnpm api:down

api-jwt: ## Generate the JWT key pairs (dev and test) if missing
	$(API_EXEC) bin/console lexik:jwt:generate-keypair --skip-if-exists
	$(API_COMPOSE) exec -T -e APP_ENV=test php bin/console lexik:jwt:generate-keypair --skip-if-exists

api-test-db: ## Create and migrate the test database
	$(API_EXEC) bin/console -e test doctrine:database:create --if-not-exists
	$(API_EXEC) bin/console -e test doctrine:migrations:migrate --no-interaction --allow-no-migration

api-migrate: ## Apply the Doctrine migrations (dev)
	$(API_EXEC) bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

api-test: ## Run the PHPUnit suite
	pnpm api:test

api-lint: ## Check PHP coding standards and run PHPStan
	$(API_EXEC) vendor/bin/php-cs-fixer check --diff
	@# PHPStan reads the compiled dev container
	$(API_EXEC) bin/console cache:warmup --quiet
	$(API_EXEC) vendor/bin/phpstan analyse --no-progress --memory-limit=512M

api-format: ## Fix PHP coding standards
	$(API_EXEC) vendor/bin/php-cs-fixer fix

api-check: ## Validate composer files, Symfony config and the Doctrine schema
	$(API_EXEC) composer validate --strict
	$(API_EXEC) bin/console lint:yaml config/ --parse-tags
	$(API_EXEC) bin/console lint:container
	$(API_EXEC) bin/console -e test lint:container
	$(API_EXEC) bin/console -e test doctrine:schema:validate

api-prod-image: ## Check that the production image builds
	cd $(API_DIR) && docker build --target frankenphp_prod -t $(API_PROD_IMAGE) .
	docker image rm $(API_PROD_IMAGE)

api-shell: ## Open a shell in the PHP container
	$(API_COMPOSE) exec php sh

api-console: ## Run a Symfony console command: make api-console ARGS="debug:router"
	$(API_EXEC) bin/console $(ARGS)
