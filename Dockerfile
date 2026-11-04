# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/api-client/package.json ./packages/api-client/
COPY prisma ./prisma
RUN npm install

# ---- API ----
FROM base AS api-build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build -w @smart-campus/shared-types
RUN npm run build -w @smart-campus/validation
RUN npm run build -w @smart-campus/api

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/package.json ./
COPY --from=api-build /app/apps/api ./apps/api
COPY --from=api-build /app/packages ./packages
COPY --from=api-build /app/prisma ./prisma
COPY docs ./docs
EXPOSE 4100
CMD ["sh", "-c", "npx prisma migrate deploy && node apps/api/dist/index.js"]

# ---- Web ----
FROM base AS web-build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build -w @smart-campus/shared-types
RUN npm run build -w @smart-campus/validation
RUN npm run build -w @smart-campus/api-client
RUN npm run build -w @smart-campus/web

FROM nginx:alpine AS web
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
