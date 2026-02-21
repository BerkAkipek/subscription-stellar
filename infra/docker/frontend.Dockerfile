FROM node:22-bookworm AS builder

WORKDIR /app

COPY apps/frontend/subscription_stellar_frontend/package*.json ./
RUN npm ci

COPY apps/frontend/subscription_stellar_frontend/ ./

ARG VITE_SUBSCRIPTION_CONTRACT_ID
ARG VITE_PAYMENT_CONTRACT_ID
ARG VITE_BACKEND_URL=http://localhost:8080

ENV VITE_SUBSCRIPTION_CONTRACT_ID=${VITE_SUBSCRIPTION_CONTRACT_ID}
ENV VITE_PAYMENT_CONTRACT_ID=${VITE_PAYMENT_CONTRACT_ID}
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
