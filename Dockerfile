# Detektif Data Backend - Dockerfile for Cloud Deploy (Hugging Face / Railway / Render / VPS)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Ensure database directory is writable for non-root containers (Hugging Face user 1000)
RUN chmod -R 777 /app

# Default environment variables
ENV NODE_ENV=production
ENV PORT=7860
ENV HOST=0.0.0.0

# Expose backend port (Hugging Face default is 7860)
EXPOSE 7860

# Start the server (runs SQLite migrations automatically on start)
CMD ["npm", "start"]
