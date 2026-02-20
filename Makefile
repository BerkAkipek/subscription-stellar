run-backend:
	cd ./apps/backend && go run cmd/api/main.go

run-frontend:
	cd ./apps/frontend/subscription_stellar_frontend && npm run dev

run-all:
	make -j2 run-backend run-frontend