FROM node:22-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && corepack enable
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY src ./src
COPY nest-cli.json tsconfig.json ./
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat && corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3002
CMD ["node", "dist/main.js"]
