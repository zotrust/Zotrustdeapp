#!/bin/bash

# VPS Database Setup Script for Zotrust
echo "🔧 Zotrust VPS Database Setup"
echo "=============================="
echo ""

# Check if database exists
echo "🔍 Checking if database 'zotrust' exists..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='zotrust'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "✅ Database 'zotrust' already exists!"
else
    echo "📦 Creating database 'zotrust'..."
    sudo -u postgres createdb zotrust
    echo "✅ Database created successfully!"
fi

echo ""
echo "🔄 Running schema migrations..."

# Run main schema
echo "1️⃣  Running main schema..."
sudo -u postgres psql -d zotrust -f schema-master.sql

# Run additional migrations
echo "2️⃣  Running dispute resolution migration..."
sudo -u postgres psql -d zotrust -f migrations/dispute-resolution-system.sql

echo "3️⃣  Running reviews table migration..."
sudo -u postgres psql -d zotrust -f migrations/create-reviews-table.sql

echo "4️⃣  Running WBNB token migration..."
sudo -u postgres psql -d zotrust -f migrations/add-wbnb-token.sql

echo "5️⃣  Running reviews table update..."
sudo -u postgres psql -d zotrust -f migrations/update-reviews-table-optional-order.sql

echo ""
echo "🔍 Verifying database setup..."
TABLE_COUNT=$(sudo -u postgres psql -d zotrust -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
echo "📊 Total tables created: $TABLE_COUNT"

echo ""
echo "🎉 VPS Database setup complete!"
echo ""
echo "You can now start the backend server with:"
echo "  npm start"
echo ""
