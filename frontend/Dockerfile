# Use Node.js 18 Alpine image with Bun
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY ./frontend/package*.json ./frontend/bun.lock ./

# Install dependencies with Bun
RUN bun install

# Copy frontend code
COPY ./frontend .

# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]