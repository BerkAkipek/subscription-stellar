# syntax=docker/dockerfile:1.7

FROM golang:1.25-bookworm AS builder

WORKDIR /app

# Copy module files first for better build cache usage.
COPY apps/backend/go.mod apps/backend/go.sum ./apps/backend/
COPY packages/stellar/go.mod ./packages/stellar/

WORKDIR /app/apps/backend
RUN go mod download

WORKDIR /app
COPY . .

WORKDIR /app/apps/backend
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/backend ./cmd/api

FROM debian:bookworm-slim AS runtime

ARG STELLAR_CLI_VERSION=25.1.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libdbus-1-3 libudev1 \
    && rm -rf /var/lib/apt/lists/*

# Install stellar CLI from a pinned Debian package release asset.
RUN \
    set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64|arm64) : ;; \
      *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    deb="stellar-cli_${STELLAR_CLI_VERSION}_${arch}.deb"; \
    curl --retry 5 --retry-all-errors --retry-delay 2 -fsSL "https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI_VERSION}/${deb}" -o /tmp/stellar-cli.deb; \
    apt-get update; \
    apt-get install -y --no-install-recommends /tmp/stellar-cli.deb; \
    rm -f /tmp/stellar-cli.deb; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /out/backend /app/backend

EXPOSE 8080

ENV BACKEND_ADDR=:8080
CMD ["/app/backend"]
