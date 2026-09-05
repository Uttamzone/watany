FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_BASE_URL=https://wataniandsons.ca
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL=https://wataniandsons.ca
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN NODE_OPTIONS="--max-old-space-size=768" npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# output: "standalone" (next.config.ts) - only needed node_modules files, no full tree.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Standalone server binds 127.0.0.1 unless HOSTNAME is set - else unreachable from outside.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=384"

EXPOSE 3000
CMD ["node", "server.js"]
