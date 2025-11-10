#!/bin/bash

# =============================================
# Export Complete Database Schema from PostgreSQL
# Database: zotrust
# =============================================

echo "📦 Exporting complete database schema from PostgreSQL..."
echo "========================================================"
echo ""

# Database credentials (can be overridden by environment variables)
DB_NAME="${DB_NAME:-zotrust}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Output file
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_FILE="zotrust-complete-schema-export-${TIMESTAMP}.sql"
SCHEMA_ONLY_FILE="zotrust-schema-only-${TIMESTAMP}.sql"
DATA_ONLY_FILE="zotrust-data-only-${TIMESTAMP}.sql"

# Prompt for password if not set
if [ -z "$DB_PASSWORD" ]; then
    read -sp "Enter PostgreSQL password for user '$DB_USER' (default: postgres): " DB_PASSWORD
    echo ""
    DB_PASSWORD=${DB_PASSWORD:-postgres}
fi

export PGPASSWORD=$DB_PASSWORD

# Check if database exists
echo "🔍 Checking if database '$DB_NAME' exists..."
DB_EXISTS=$(psql -U $DB_USER -h $DB_HOST -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME && echo "yes" || echo "no")

if [ "$DB_EXISTS" = "no" ]; then
    echo "❌ Database '$DB_NAME' does not exist!"
    echo ""
    echo "Would you like to create it? (y/n)"
    read -r CREATE_DB
    if [ "$CREATE_DB" = "y" ] || [ "$CREATE_DB" = "Y" ]; then
        echo "📦 Creating database '$DB_NAME'..."
        createdb -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME
        if [ $? -eq 0 ]; then
            echo "✅ Database created successfully!"
        else
            echo "❌ Failed to create database!"
            exit 1
        fi
    else
        echo "Exiting..."
        exit 1
    fi
else
    echo "✅ Database '$DB_NAME' found!"
fi

echo ""

# Export complete schema (structure + data)
echo "📤 Exporting complete database (schema + data)..."
pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT \
    -d $DB_NAME \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    -f "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Complete database exported to: $OUTPUT_FILE"
    echo "📊 File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
    echo "📄 Total lines: $(wc -l < "$OUTPUT_FILE")"
else
    echo "❌ Export failed!"
    exit 1
fi

echo ""

# Export schema only (structure)
echo "📤 Exporting schema only (structure, no data)..."
pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT \
    -d $DB_NAME \
    --schema-only \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    -f "$SCHEMA_ONLY_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Schema-only exported to: $SCHEMA_ONLY_FILE"
    echo "📊 File size: $(du -h "$SCHEMA_ONLY_FILE" | cut -f1)"
else
    echo "⚠️  Schema-only export failed (continuing...)"
fi

echo ""

# Export data only
echo "📤 Exporting data only (no structure)..."
pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT \
    -d $DB_NAME \
    --data-only \
    --no-owner \
    --no-privileges \
    -f "$DATA_ONLY_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Data-only exported to: $DATA_ONLY_FILE"
    echo "📊 File size: $(du -h "$DATA_ONLY_FILE" | cut -f1)"
else
    echo "⚠️  Data-only export failed (continuing...)"
fi

echo ""
echo "========================================================"
echo "✅ Export Complete!"
echo "========================================================"
echo ""
echo "📁 Generated files:"
echo "   1. Complete (schema + data): $OUTPUT_FILE"
echo "   2. Schema only: $SCHEMA_ONLY_FILE"
echo "   3. Data only: $DATA_ONLY_FILE"
echo ""
echo "💡 To restore database:"
echo "   psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f $OUTPUT_FILE"
echo ""

# Unset password
unset PGPASSWORD

