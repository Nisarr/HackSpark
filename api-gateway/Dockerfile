# ── Build stage ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# ── Runtime stage ──
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/src ./src
EXPOSE 8000
CMD ["node", "src/index.js"]