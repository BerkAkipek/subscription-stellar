# Stellar Subscription Service

Monorepo for a Stellar Testnet subscription app with native XLM billing.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Go API
- Contracts: Soroban (Rust)

## Repository Structure

```text
.
├── apps
│   ├── backend
│   └── frontend/subscription_stellar_frontend
├── packages
│   ├── contracts/subscription
│   └── stellar
├── infra
└── Makefile
```

## Current Testnet Contracts

- Subscription contract: `CBPVGE3CNJUFF46O6VLXZXQO2F35JJN2UO2D2RUSY5WPJUMLBT6KVGQ4`
- Native XLM SAC (payment contract): `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

## Features

- Wallet connect/disconnect (wallet selector/freighter providers)
- Send 1 XLM to self (wallet tx sanity path)
- Subscribe on-chain with native XLM payment
- Inter-contract transfer during subscribe (`subscription -> native SAC transfer`)
- Read subscription state (`plan_id`, `expires_at`)
- Read XLM SAC balance (stroops) and render as XLM
- Backend observed state polling (`/api/state`) with latest subscription, balance, and recent events
- Progress + loading states for async actions
- Client-side cache for faster hydration:
- `balances` TTL: 30s
- `subscription` TTL: 15s
- One-page futuristic/minimal UI optimized for desktop and mobile

## Subscription Model

- Plan: `plan_id = 1`
- Duration: `3600` seconds (1 hour)
- Price: `10_000_000` stroops (`1 XLM`)

## Environment

Frontend (`apps/frontend/subscription_stellar_frontend/.env`):

```env
VITE_SUBSCRIPTION_CONTRACT_ID=CBPVGE3CNJUFF46O6VLXZXQO2F35JJN2UO2D2RUSY5WPJUMLBT6KVGQ4
VITE_PAYMENT_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
VITE_BACKEND_URL=http://localhost:8080
```

Backend:

- `SUBSCRIPTION_CONTRACT_ID`
- `PAYMENT_CONTRACT_ID`
- `STELLAR_NETWORK` (default `testnet`)
- `STELLAR_SOURCE` (optional; if empty backend uses the request user as `--source-account` for read calls)

Reference file: `infra/env/testnet.env`.

## Quick Start

1. Frontend deps:

```bash
cd apps/frontend/subscription_stellar_frontend
npm install
```

2. Frontend env:

```bash
cp .env.example .env
```

3. Run backend + frontend:

```bash
make r
```

4. Open `http://localhost:5173`

## Docker Run (Backend + Frontend)

The repository now includes Docker files in `infra/docker`.

1. Start with Docker via Makefile:

```bash
make docker-up
```

This command auto-creates `infra/docker/.env.backend` from the example if missing.

2. Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8080/healthz`

3. Stop:

```bash
make docker-down
```

Notes:
- `infra/docker/backend.Dockerfile` installs `stellar` CLI (required by backend runtime calls).
- Frontend is built as static assets and served via Nginx (`infra/docker/frontend.Dockerfile`).
- To change contract ids or network values, edit `infra/docker/.env.backend`.
- Useful commands: `make docker-logs`, `make docker-ps`, `make docker-env`.

## Docker Production Override

Use the production override for server deployment:
- Enables stronger restart policy (`always`)
- Adds backend + frontend healthchecks (from base compose)
- Exposes only frontend on host port `80`
- Routes frontend `/api/*` to backend internally via Nginx

Run:

```bash
make docker-prod-up
```

Stop:

```bash
make docker-prod-down
```

## Backend API

- `GET /healthz` -> `{ "ok": true }`
- `GET /api/state?user=<G...>` -> subscription state, XLM balance in stroops, recent events, observed timestamp, network, contract ids

## Commands

- `make r` / `make run-all`: run backend + frontend
- `make rb`: backend only
- `make rf`: frontend only
- `make t`: all tests
- `make tb`: backend tests
- `make tf`: frontend tests
- `make c`: coverage
- `make cl`: cleanup

## Testing

Frontend tests (`apps/frontend/subscription_stellar_frontend/tests`):

- `tests/lib/getBalance.test.ts`
- `tests/lib/sendXLM.test.ts`
- `tests/contract.client.test.ts`
- `tests/lib/cache.test.ts`

Run:

```bash
cd apps/frontend/subscription_stellar_frontend
npm test -- --run
```

Backend:

```bash
cd apps/backend
go test ./...
```

Test evidence screenshot:

![Frontend and backend tests passing](docs/screenshots/tests-passing-small.svg)

## Contract Workspace

- Path: `packages/contracts/subscription`
- Main subscription contract source:
- `packages/contracts/subscription/contracts/subscription/src/lib.rs`

## Notes

- App is configured for Stellar Testnet.
- `PAYMENT_CONTRACT_ID` is the active payment contract (native XLM SAC).
- `TOKENIZATION_CONTRACT_ID` remains only as legacy fallback compatibility in parts of the codebase.

## Demo

- Video: [Watch the 1-minute demo](https://www.loom.com/share/96419e34835643668225477a101b800e)

## License

MIT
