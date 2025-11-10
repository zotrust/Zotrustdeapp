#!/bin/bash

# Export Complete Database Schema from PostgreSQL
# Database: zotrust

echo "📦 Exporting complete database schema..."
echo "=========================================="
echo ""

# Database credentials
DB_NAME="zotrust"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Output file
OUTPUT_FILE="zotrust-complete-schema-export.sql"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_FILE_WITH_TIME="zotrust-complete-schema-${TIMESTAMP}.sql"

# Check if database exists
echo "🔍 Checking if database '$DB_NAME' exists..."
PGPASSWORD=${DB_PASSWORD:-postgres} psql -U $DB_USER -h $DB_HOST -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME

if [ $? -ne 0 ]; then
    echo "❌ Database '$DB_NAME' does not exist!"
    echo "Please create the database first or check your connection settings."
    exit 1
fi

echo "✅ Database found!"
echo ""

# Export schema only (no data)
echo "📤 Exporting schema (structure only)..."
PGPASSWORD=${DB_PASSWORD:-postgres} pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT \
    -d $DB_NAME \
    --schema-only \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    -f "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Schema exported successfully to: $OUTPUT_FILE"
    cp "$OUTPUT_FILE" "$OUTPUT_FILE_WITH_TIME"
    echo "✅ Backup copy created: $OUTPUT_FILE_WITH_TIME"
    echo ""
    echo "📊 File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
    echo "📄 Total lines: $(wc -l < "$OUTPUT_FILE")"
else
    echo "❌ Export failed!"
    exit 1
fi

echo ""
echo "✅ Complete! Schema exported to: $OUTPUT_FILE"
