FROM node:18-alpine

# Security: Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Install production dependencies first (caching layer)
COPY package*.json ./
RUN npm ci --only=production

# Create critical folders so the unprivileged user has ownership
RUN mkdir -p public data && chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Copy application files (ignoring files in .dockerignore)
COPY --chown=appuser:appgroup . .

# Set default Environment Variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the Universal API Port
EXPOSE 3000

# Boot the universal server
CMD ["npm", "start"]
