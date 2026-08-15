# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, so
# they must arrive as build args. Supplying them only as runtime env has no
# effect on the client-side code.
#
# SUPABASE_SERVICE_ROLE_KEY is deliberately NOT an arg — it is read server-side
# at runtime and must never be prefixed NEXT_PUBLIC_ or baked into the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" \
 || (echo "FATAL: NEXT_PUBLIC_SUPABASE_URL build arg is required" >&2; exit 1)
RUN test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
 || (echo "FATAL: NEXT_PUBLIC_SUPABASE_ANON_KEY build arg is required" >&2; exit 1)

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Refuse to ship an image that leaked a service_role key to the browser.
RUN if grep -rqs 'service_role' .next/static; then \
      echo "FATAL: a service_role key reached the client bundle. Aborting." >&2; \
      exit 1; \
    fi

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
