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
echo "🔄 Running database migrations..."

# Stamp the database to mark current schema version (safe if already stamped)
echo "📌 Ensuring database is stamped..."
alembic stamp head 2>/dev/null || echo "Database already stamped or migration table exists"

# Run any pending migrations
echo "⬆️ Applying migrations..."
alembic upgrade head 2>/dev/null || echo "No new migrations to apply"

echo "✅ Database ready!"

# Start the application
echo "🎯 Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
