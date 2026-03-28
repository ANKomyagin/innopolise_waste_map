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

# Check if alembic_version table exists
if ! alembic current 2>/dev/null | grep -q "head"; then
    echo "📌 Stamping existing database schema..."
    # If tables exist but no alembic version, stamp as current version
    alembic stamp head 2>/dev/null || true
fi

# Run migrations
alembic upgrade head

echo "✅ Migrations complete!"

# Start the application
echo "🎯 Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
