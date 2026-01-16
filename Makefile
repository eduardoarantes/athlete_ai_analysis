# Makefile for Cycling AI Analysis
# Manages both Python API (FastAPI) and Web (Next.js) services
#
# Usage: make [target]

.PHONY: help status start stop restart logs clean build check \
        api-status api-start api-stop api-restart api-logs \
        web-status web-start web-stop web-restart web-logs \
        install test report

# Ports
API_PORT ?= 8000
WEB_PORT ?= 3000

# Directories
ROOT_DIR := $(shell pwd)
WEB_DIR := $(ROOT_DIR)/web
VENV := $(ROOT_DIR)/.venv

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

#==============================================================================
# HELP
#==============================================================================

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Combined targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -v "^api-\|^web-" | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "API targets (Python FastAPI on port $(API_PORT)):"
	@grep -E '^api-[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "Web targets (Next.js on port $(WEB_PORT)):"
	@grep -E '^web-[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

#==============================================================================
# COMBINED TARGETS
#==============================================================================

status: api-status web-status ## Check status of all services

start: api-start web-start ## Start all services
	@echo ""
	@echo "$(GREEN)All services started$(NC)"
	@echo "  API: http://localhost:$(API_PORT)"
	@echo "  Web: http://localhost:$(WEB_PORT)"

stop: api-stop web-stop ## Stop all services
	@echo ""
	@echo "$(GREEN)All services stopped$(NC)"

restart: stop start ## Restart all services

logs: ## Show logs for all services (in split view)
	@echo "Use 'make api-logs' or 'make web-logs' to view individual logs"
	@echo "Or run: tail -f .api.log & tail -f web/.dev.log"

clean: ## Clean all build artifacts and logs
	@echo "Cleaning..."
	@rm -rf .api.log $(WEB_DIR)/.dev.log
	@rm -rf $(WEB_DIR)/.next
	@rm -rf .mypy_cache .pytest_cache .ruff_cache
	@rm -rf htmlcov .coverage
	@echo "$(GREEN)Cleaned$(NC)"

install: ## Install all dependencies
	@echo "Installing Python dependencies..."
	@if [ -f "$(VENV)/bin/pip" ]; then \
		$(VENV)/bin/pip install -e ".[dev]"; \
	else \
		echo "Creating virtual environment..."; \
		python3 -m venv $(VENV); \
		$(VENV)/bin/pip install -e ".[dev]"; \
	fi
	@echo ""
	@echo "Installing Node dependencies..."
	@cd $(WEB_DIR) && pnpm install
	@echo ""
	@echo "$(GREEN)All dependencies installed$(NC)"

test: ## Run all tests
	@echo "Running Python tests..."
	@$(VENV)/bin/pytest tests/ -v
	@echo ""
	@echo "Running Web tests..."
	@cd $(WEB_DIR) && pnpm test:unit:run

check: ## Run all checks (types, lint, format)
	@echo "=== Python Checks ==="
	@$(VENV)/bin/mypy src/cycling_ai --strict || true
	@$(VENV)/bin/ruff check src/cycling_ai
	@echo ""
	@echo "=== Web Checks ==="
	@cd $(WEB_DIR) && pnpm type-check
	@cd $(WEB_DIR) && pnpm lint
	@echo ""
	@echo "$(GREEN)All checks completed$(NC)"

#==============================================================================
# API TARGETS (Python FastAPI)
#==============================================================================

api-status: ## Check if the API server is running
	@if lsof -i :$(API_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		echo "$(GREEN)API server is RUNNING on port $(API_PORT)$(NC)"; \
		lsof -i :$(API_PORT) -sTCP:LISTEN | grep -v "^COMMAND"; \
	else \
		echo "$(RED)API server is NOT running on port $(API_PORT)$(NC)"; \
	fi

api-start: ## Start the API server in background
	@if lsof -i :$(API_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		echo "$(YELLOW)API server is already running on port $(API_PORT)$(NC)"; \
	else \
		echo "Starting API server on port $(API_PORT)..."; \
		nohup $(VENV)/bin/uvicorn cycling_ai.api.main:app \
			--host 0.0.0.0 \
			--port $(API_PORT) \
			--reload \
			> .api.log 2>&1 & \
		sleep 2; \
		if lsof -i :$(API_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
			echo "$(GREEN)API server started$(NC)"; \
			echo "  URL: http://localhost:$(API_PORT)"; \
			echo "  Docs: http://localhost:$(API_PORT)/docs"; \
			echo "  Logs: make api-logs"; \
		else \
			echo "$(RED)Failed to start API server. Check .api.log$(NC)"; \
			tail -20 .api.log; \
		fi \
	fi

api-stop: ## Stop the API server
	@if lsof -i :$(API_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		echo "Stopping API server on port $(API_PORT)..."; \
		lsof -ti :$(API_PORT) | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
		echo "$(GREEN)API server stopped$(NC)"; \
	else \
		echo "API server is not running on port $(API_PORT)"; \
	fi

api-restart: api-stop api-start ## Restart the API server

api-logs: ## Show API server logs (tail -f)
	@if [ -f .api.log ]; then \
		tail -f .api.log; \
	else \
		echo "No API log file found. Start the server first: make api-start"; \
	fi

api-dev: ## Run API server in foreground (interactive)
	$(VENV)/bin/uvicorn cycling_ai.api.main:app --host 0.0.0.0 --port $(API_PORT) --reload

#==============================================================================
# WEB TARGETS (Next.js)
#==============================================================================

web-status: ## Check if the web server is running
	@if lsof -i :$(WEB_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		echo "$(GREEN)Web server is RUNNING on port $(WEB_PORT)$(NC)"; \
		lsof -i :$(WEB_PORT) -sTCP:LISTEN | grep -v "^COMMAND"; \
	else \
		echo "$(RED)Web server is NOT running on port $(WEB_PORT)$(NC)"; \
	fi

web-start: ## Start the web server in background
	@if lsof -i :$(WEB_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		echo "$(YELLOW)Web server is already running on port $(WEB_PORT)$(NC)"; \
	else \
		echo "Starting web server on port $(WEB_PORT)..."; \
		cd $(WEB_DIR) && nohup pnpm dev > .dev.log 2>&1 & \
		sleep 3; \
		if lsof -i :$(WEB_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
			echo "$(GREEN)Web server started$(NC)"; \
			echo "  URL: http://localhost:$(WEB_PORT)"; \
			echo "  Logs: make web-logs"; \
		else \
			echo "$(RED)Failed to start web server. Check web/.dev.log$(NC)"; \
			tail -20 $(WEB_DIR)/.dev.log; \
		fi \
	fi

web-stop: ## Stop the web server
	@if lsof -i :$(WEB_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		echo "Stopping web server on port $(WEB_PORT)..."; \
		lsof -ti :$(WEB_PORT) | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
		echo "$(GREEN)Web server stopped$(NC)"; \
	else \
		echo "Web server is not running on port $(WEB_PORT)"; \
	fi

web-restart: web-stop web-start ## Restart the web server

web-logs: ## Show web server logs (tail -f)
	@if [ -f $(WEB_DIR)/.dev.log ]; then \
		tail -f $(WEB_DIR)/.dev.log; \
	else \
		echo "No web log file found. Start the server first: make web-start"; \
	fi

web-dev: ## Run web server in foreground (interactive)
	cd $(WEB_DIR) && pnpm dev

web-build: ## Build web for production
	cd $(WEB_DIR) && pnpm build

#==============================================================================
# COMPLIANCE REPORT GENERATION
#==============================================================================

# Report generation variables
REPORT_OUTPUT ?= workout_comparison_report_dtw.html
MAPPING_CSV ?= data/workout_to_activity_mapping.csv
WORKOUT_LIBRARY ?= data/workout_library.json
STREAMS_DIR ?= data
FTP ?= 250
FTP_CSV ?= data/ftp.csv

report: ## Generate workout compliance report with DTW alignment
	@if [ ! -f $(MAPPING_CSV) ]; then \
		echo "$(RED)Error: Mapping CSV not found: $(MAPPING_CSV)$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f $(WORKOUT_LIBRARY) ]; then \
		echo "$(RED)Error: Workout library not found: $(WORKOUT_LIBRARY)$(NC)"; \
		exit 1; \
	fi
	@echo "Generating compliance report..."
	@echo "  Mapping: $(MAPPING_CSV)"
	@echo "  Library: $(WORKOUT_LIBRARY)"
	@echo "  Streams: $(STREAMS_DIR)"
	@echo "  Output: $(REPORT_OUTPUT)"
	@$(VENV)/bin/python scripts/generate_compliance_report.py \
		--mapping-csv $(MAPPING_CSV) \
		--workout-library $(WORKOUT_LIBRARY) \
		--streams-dir $(STREAMS_DIR) \
		--report-output $(REPORT_OUTPUT) \
		--ftp $(FTP) \
		--ftp-csv $(FTP_CSV)

#==============================================================================
# CONVENIENCE ALIASES
#==============================================================================

up: start ## Alias for start
down: stop ## Alias for stop
