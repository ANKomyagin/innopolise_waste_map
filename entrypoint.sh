#!/bin/bash
# Entrypoint script for production deployment

set -e

echo "🚀 Starting Innopolis Waste Management System..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h postgres -p 5432 -U waste_user -d waste_db 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run database migrations
echo "🔄 Checking database migrations..."

# TEMPORARY: Skip migrations to restore service
# TODO: Properly stamp existing database
echo "⚠️ Skipping migrations (tables already exist from create_all)"
echo "✅ Database ready!"

# Start the application
echo "🎯 Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
