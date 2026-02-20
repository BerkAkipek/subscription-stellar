# ==============================
# PROJECT PATHS
# ==============================
BACKEND_DIR=./apps/backend
FRONTEND_DIR=./apps/frontend/subscription_stellar_frontend

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