# ==============================
# PROJECT PATHS
# ==============================
BACKEND_DIR=./apps/backend
FRONTEND_DIR=./apps/frontend/subscription_stellar_frontend
DOCKER_ENV=infra/docker/.env.backend
DOCKER_BASE=-f infra/docker/docker-compose.yml --env-file $(DOCKER_ENV)
DOCKER_PROD=-f infra/docker/docker-compose.yml -f infra/docker/compose.prod.yml --env-file $(DOCKER_ENV)

# ==============================
# RUN APPLICATION
# ==============================

run-backend:
	cd $(BACKEND_DIR) && go run cmd/api/main.go

run-frontend:
	cd $(FRONTEND_DIR) && npm run dev

# run both servers in parallel
run-all:
	make -j2 run-backend run-frontend

# short aliases
r: run-all
rb: run-backend
rf: run-frontend


# ==============================
# TESTS
# ==============================

test-backend:
	cd $(BACKEND_DIR) && go test ./...

test-frontend:
	cd $(FRONTEND_DIR) && npm test

# run all tests in parallel
test:
	make -j2 test-backend test-frontend

# aliases
t: test
tb: test-backend
tf: test-frontend


# ==============================
# COVERAGE (optional future use)
# ==============================

coverage-backend:
	cd $(BACKEND_DIR) && go test ./... -cover

coverage-frontend:
	cd $(FRONTEND_DIR) && npm test -- --coverage

coverage:
	make -j2 coverage-backend coverage-frontend

c: coverage


# ==============================
# CLEANUP
# ==============================

clean-backend:
	cd $(BACKEND_DIR) && go clean

clean-frontend:
	cd $(FRONTEND_DIR) && rm -rf node_modules dist

clean:
	make -j2 clean-backend clean-frontend

cl: clean


# ==============================
# DOCKER
# ==============================

docker-env:
	cp -n infra/docker/.env.backend.example $(DOCKER_ENV) || true

docker-up: docker-env
	docker compose $(DOCKER_BASE) up -d --build

docker-down:
	docker compose $(DOCKER_BASE) down

docker-logs:
	docker compose $(DOCKER_BASE) logs -f --tail=200

docker-ps:
	docker compose $(DOCKER_BASE) ps

docker-prod-up: docker-env
	FRONTEND_PORT=80 BACKEND_BIND=127.0.0.1:8080 docker compose $(DOCKER_PROD) up -d --build

docker-prod-down:
	FRONTEND_PORT=80 BACKEND_BIND=127.0.0.1:8080 docker compose $(DOCKER_PROD) down

# aliases
de: docker-env
du: docker-up
dd: docker-down
dl: docker-logs
dp: docker-ps
dpu: docker-prod-up
dpd: docker-prod-down


# ==============================
# HELP
# ==============================

help:
	@echo ""
	@echo "Available commands:"
	@echo ""
	@echo " Run app:"
	@echo "   make run-all (r)     → run backend + frontend"
	@echo "   make rb              → backend only"
	@echo "   make rf              → frontend only"
	@echo ""
	@echo " Tests:"
	@echo "   make test (t)        → run all tests"
	@echo "   make tb              → backend tests"
	@echo "   make tf              → frontend tests"
	@echo ""
	@echo " Coverage:"
	@echo "   make coverage (c)"
	@echo ""
	@echo " Cleanup:"
	@echo "   make clean (cl)"
	@echo ""
	@echo " Docker (dev):"
	@echo "   make docker-env (de)      → create infra/docker/.env.backend if missing"
	@echo "   make docker-up (du)       → run docker compose in background"
	@echo "   make docker-down (dd)     → stop dev docker compose stack"
	@echo "   make docker-logs (dl)     → tail docker compose logs"
	@echo "   make docker-ps (dp)       → list docker compose services"
	@echo ""
	@echo " Docker (prod):"
	@echo "   make docker-prod-up (dpu) → run prod override stack on :80"
	@echo "   make docker-prod-down (dpd) → stop prod override stack"
	@echo ""
