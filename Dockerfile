# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit 2>/dev/null || npm install --prefer-offline --no-audit

# Copy source code
COPY . .

# Build static export
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY docker/entrypoint.sh /docker-entrypoint.d/99-klog-files.sh
RUN chmod +x /docker-entrypoint.d/99-klog-files.sh

# Copy static build output
COPY --from=builder /app/out /usr/share/nginx/html

# Expose port
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
