# Stage 1: Build the frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: Build the backend
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend ./
RUN npx tsc

# Stage 3: Setup production environment
FROM node:22-alpine
WORKDIR /app

# Set Node environment to production
ENV NODE_ENV=production
ENV PORT=4000

# Copy backend package.json and install only production dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy compiled backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy built frontend to backend/public directory to be served by Express
COPY --from=frontend-builder /app/frontend/dist ./public

# Expose the API and Web port
EXPOSE 4000

# Start the application
CMD ["node", "dist/index.js"]
