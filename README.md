# Stellar Subscription Service

A full-stack web application that demonstrates wallet-based payments on the Stellar network.
Users connect their Freighter wallet, view balances, and send testnet transactions directly from the UI.

This project is built as a monorepo with a Go backend and a React + TypeScript frontend.

## Features

- Connect Stellar wallet via Freighter

- Display on-chain balances from Horizon

- Send XLM transaction on testnet

- Show transaction result to the user

- Unit tests for blockchain logic

- Monorepo setup with Makefile orchestration

## Architecture

subscription_stellar/
│
├── apps/
│ ├── backend/ → Go API (subscription logic later)
│ └── frontend/ → React + Vite UI
│
├── packages/ → shared logic (future)
├── infra/ → docker/env configs
└── Makefile → dev/test commands

## Setup Instructions

Clone the repository

git clone https://github.com/BerkAkipek/subscription-stellar.git

cd subscription-stellar

Install frontend dependencies

cd apps/frontend/subscription_stellar_frontend
npm install

Run the application

From project root:

make r

This starts both the Go backend and the React frontend.

Frontend runs at:

http://localhost:5173

Connect wallet

Install Freighter wallet extension

Switch network to Testnet

Fund your wallet using Friendbot

Click Connect Wallet in the app

Approve the connection in Freighter

## Run tests

From project root:

make t

Or run individually:

make tf (frontend tests)
make tb (backend tests)

## Screenshots

Wallet Connected State
Add screenshot here: docs/screenshots/wallet-connected.png

Balance Displayed
Add screenshot here: docs/screenshots/balance.png

Successful Testnet Transaction
Add screenshot here: docs/screenshots/transaction-popup.png

Transaction Result Shown to User
Add screenshot here: docs/screenshots/transaction-success.png

## License

MIT