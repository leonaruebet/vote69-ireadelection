# ──────────────────────────────────────────────────────────
# vote69 — Next.js dev server management
# Usage:  make start | make stop | make status | make restart
# ──────────────────────────────────────────────────────────

PORT   ?= 3000
PID_FILE = .dev.pid

.PHONY: start stop restart status logs build lint clean help

## ─── Dev Server ──────────────────────────────────────────

start: ## Start Next.js dev server on PORT (default 3000)
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "⚠  Already running (PID $$(cat $(PID_FILE))) on port $(PORT)"; \
	else \
		echo "▶  Starting dev server on port $(PORT)…"; \
		nohup npx next dev --port $(PORT) > .dev.log 2>&1 & \
		echo $$! > $(PID_FILE); \
		sleep 2; \
		if kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
			echo "✓  Running (PID $$(cat $(PID_FILE)))  →  http://localhost:$(PORT)"; \
		else \
			echo "✗  Failed to start — check .dev.log"; \
			rm -f $(PID_FILE); \
			exit 1; \
		fi; \
	fi

stop: ## Stop the running dev server
	@if [ -f $(PID_FILE) ]; then \
		PID=$$(cat $(PID_FILE)); \
		echo "■  Stopping server (PID $$PID)…"; \
		kill $$PID 2>/dev/null || true; \
		rm -f $(PID_FILE); \
		sleep 1; \
		if lsof -ti :$(PORT) >/dev/null 2>&1; then \
			echo "   Killing remaining processes on port $(PORT)…"; \
			lsof -ti :$(PORT) | xargs kill -9 2>/dev/null || true; \
		fi; \
		echo "✓  Stopped"; \
	else \
		echo "⚠  No PID file found"; \
		if lsof -ti :$(PORT) >/dev/null 2>&1; then \
			echo "   Found process on port $(PORT) — killing…"; \
			lsof -ti :$(PORT) | xargs kill -9 2>/dev/null || true; \
			echo "✓  Killed"; \
		else \
			echo "   Nothing running on port $(PORT)"; \
		fi; \
	fi

restart: stop start ## Restart the dev server

status: ## Show server status
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "✓  Running (PID $$(cat $(PID_FILE)))  →  http://localhost:$(PORT)"; \
	elif lsof -ti :$(PORT) >/dev/null 2>&1; then \
		echo "⚠  Port $(PORT) in use (PID $$(lsof -ti :$(PORT) | head -1)) but no PID file"; \
	else \
		echo "■  Not running"; \
	fi

logs: ## Tail the dev server logs
	@if [ -f .dev.log ]; then \
		tail -f .dev.log; \
	else \
		echo "No log file found — is the server running?"; \
	fi

## ─── Build & Lint ────────────────────────────────────────

build: ## Production build
	npx next build

lint: ## Run ESLint
	npx eslint

## ─── Cleanup ─────────────────────────────────────────────

clean: stop ## Stop server + remove build artifacts
	rm -rf .next .dev.log .dev.pid
	@echo "✓  Cleaned"

## ─── Help ────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
