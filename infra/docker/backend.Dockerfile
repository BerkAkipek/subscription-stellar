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

ARG STELLAR_CLI_INSTALL_REF=main
ENV PATH="/root/.local/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libdbus-1-3 \
    && rm -rf /var/lib/apt/lists/*

# Install stellar CLI via official installer.
RUN curl -fsSL "https://github.com/stellar/stellar-cli/raw/${STELLAR_CLI_INSTALL_REF}/install.sh" | sh

WORKDIR /app
COPY --from=builder /out/backend /app/backend

EXPOSE 8080

ENV BACKEND_ADDR=:8080
CMD ["/app/backend"]
