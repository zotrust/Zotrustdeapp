#!/bin/bash

# =============================================
# Run Trading Hours Settings Script
# =============================================

# Database connection details (update these as needed)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-zotrust}"
DB_USER="${DB_USER:-postgres}"

echo "🚀 Running Trading Hours Settings Script..."
echo "📊 Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Run the SQL script
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$(dirname "$0")/add-trading-hours-settings.sql"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Trading hours settings added successfully!"
else
    echo ""
    echo "❌ Error: Failed to add trading hours settings"
    exit 1
fi

