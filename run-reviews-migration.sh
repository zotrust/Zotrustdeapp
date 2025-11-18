#!/bin/bash

# Run this on VPS to add is_visible column to reviews table

echo "🔄 Adding is_visible column to reviews table..."

# Database credentials from .env
DB_HOST="185.112.144.66"
DB_PORT="5432"
DB_NAME="zotrust"
DB_USER="postgres"

# Run migration
PGPASSWORD=postgres psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f backend/migrations/add-is-visible-to-reviews.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Verifying column..."
    PGPASSWORD=postgres psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'is_visible';"
else
    echo "❌ Migration failed!"
    exit 1
fi

