# Use Node.js 18 Alpine image with Bun
FROM oven/bun:1

# API URL injected at build time (defaults to localhost for dev)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Set working directory
WORKDIR /app

# Copy package files
COPY frontend/package*.json frontend/bun.lock ./

# Install dependencies with Bun
RUN bun install --frozen-lockfile

# Copy frontend code
COPY frontend/ .

# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]