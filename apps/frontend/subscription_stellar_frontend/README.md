# Frontend: Subscription Stellar App

React + TypeScript + Vite frontend for wallet actions and Soroban subscription interactions.

## Features

- Connect wallet (selector/freighter flow)
- Display balances
- Send XLM transaction
- Subscribe to contract plan
- Read current subscription
- Loading states and progress indicator for long-running actions
- Basic local cache for faster UI hydration

## Environment

Create `.env` in this folder:

```env
VITE_CONTRACT_ID=YOUR_SOROBAN_CONTRACT_ID
```

You can copy the example:

```bash
cp .env.example .env
```

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Default URL: `http://localhost:5173`

## Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: type-check and production build
- `npm run preview`: preview production build
- `npm run lint`: run ESLint
- `npm test`: run Vitest

## Contract Client Logic

Main contract client file:
- `src/contract/client.ts`

Exposed operations:
- `subscribe(userAddress, planId, durationSeconds)`
- `getSubscription(userAddress)`

## UX State Model

`src/App.tsx` uses explicit async states:
- `idle`
- `loading`
- `success`
- `error`

Used for:
- wallet connect
- send transaction
- subscribe flow
- initial data load

Subscription flow includes:
- live status text
- step label
- progress percentage bar

## Basic Caching

Implemented in:
- `src/lib/cache.ts`

Current cache keys/TTLs:
- `cache:balances:<address>` -> 30 seconds
- `cache:subscription:<address>` -> 15 seconds

Behavior:
- Read cache first for immediate UI render
- Refresh from network in background
- Replace cache with fresh results
- Remove invalid/expired/corrupted entries automatically

## Tests

Test directory:
- `tests/`

Current test files:
- `tests/lib/getBalance.test.ts`
- `tests/lib/sendXLM.test.ts`
- `tests/contract.client.test.ts`
- `tests/lib/cache.test.ts`

Run tests:

```bash
npm test -- --run
```
