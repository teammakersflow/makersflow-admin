# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, so
# they must arrive as build args. Supplying them only as runtime env has no
# effect on the client-side code — the container must be rebuilt (not just
# restarted) whenever these values change.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_S3_PUBLIC_BASE_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_S3_PUBLIC_BASE_URL=$NEXT_PUBLIC_S3_PUBLIC_BASE_URL

RUN test -n "$NEXT_PUBLIC_API_URL" \
 || (echo "FATAL: NEXT_PUBLIC_API_URL build arg is required" >&2; exit 1)
RUN test -n "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" \
 || (echo "FATAL: NEXT_PUBLIC_GOOGLE_CLIENT_ID build arg is required" >&2; exit 1)
RUN test -n "$NEXT_PUBLIC_S3_PUBLIC_BASE_URL" \
 || (echo "FATAL: NEXT_PUBLIC_S3_PUBLIC_BASE_URL build arg is required (file uploads break without it)" >&2; exit 1)

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `output: "standalone"` produces server.js plus a minimal node_modules.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

USER node

CMD ["node", "server.js"]
