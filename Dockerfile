FROM node:20-slim

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Cloud Run injects PORT=8080; envValidation defaults to 5000 for local dev
EXPOSE 8080

CMD ["npx", "tsx", "server/index.ts"]
