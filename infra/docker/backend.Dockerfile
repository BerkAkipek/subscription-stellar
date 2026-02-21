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

ENV PATH="/root/.local/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libdbus-1-3 tar \
    && rm -rf /var/lib/apt/lists/*

# Install stellar CLI using release artifacts.
# Uses GitHub token from BuildKit secret (if provided) to avoid API rate limits in CI.
RUN --mount=type=secret,id=github_token \
    set -eux; \
    token_file="/run/secrets/github_token"; \
    api_headers=""; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) target_arch="x86_64" ;; \
      arm64) target_arch="aarch64" ;; \
      *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    if [ -s "$token_file" ]; then \
      token="$(cat "$token_file")"; \
      api_headers="-H Authorization: Bearer ${token} -H X-GitHub-Api-Version: 2022-11-28"; \
    fi; \
    release_tag="$(sh -c "curl -fsSL ${api_headers} https://api.github.com/repos/stellar/stellar-cli/releases/latest" | sed -n 's/.*\"tag_name\": \"\\([^\"]*\\)\".*/\\1/p' | head -n1)"; \
    version="${release_tag#v}"; \
    archive="stellar-cli-${version}-${target_arch}-unknown-linux-gnu.tar.gz"; \
    curl -fsSL "https://github.com/stellar/stellar-cli/releases/download/${release_tag}/${archive}" -o /tmp/stellar-cli.tar.gz; \
    tar -xzf /tmp/stellar-cli.tar.gz -C /tmp; \
    install -m 0755 /tmp/stellar /root/.local/bin/stellar; \
    rm -f /tmp/stellar-cli.tar.gz /tmp/stellar

WORKDIR /app
COPY --from=builder /out/backend /app/backend

EXPOSE 8080

ENV BACKEND_ADDR=:8080
CMD ["/app/backend"]
