FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
ARG BACKEND_BASE_URL=http://localhost:4000
ARG ENABLE_ADMIN_CONSOLE=false
ENV BACKEND_BASE_URL=${BACKEND_BASE_URL}
ENV ENABLE_ADMIN_CONSOLE=${ENABLE_ADMIN_CONSOLE}

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY backend ./backend
COPY frontend ./frontend
RUN npm run build -w frontend

FROM node:20-alpine AS runner
WORKDIR /app
ARG ENABLE_ADMIN_CONSOLE=false
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY frontend/next.config.mjs ./frontend/next.config.mjs
ENV ENABLE_ADMIN_CONSOLE=${ENABLE_ADMIN_CONSOLE}

WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "run", "start"]
