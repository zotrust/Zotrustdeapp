#!/bin/bash

# Local Database Setup और Migration Script

echo "🔧 Zotrust Local Database Setup"
echo "================================"
echo ""

# PostgreSQL password लें
read -sp "Enter PostgreSQL password (default: postgres): " DB_PASS
echo ""
DB_PASS=${DB_PASS:-postgres}

# .env file update करें
echo "📝 Updating .env file..."
cat > .env << EOF
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zotrust
DB_USER=postgres
DB_PASSWORD=${DB_PASS}
DB_SSL=false

# JWT Secret
JWT_SECRET=your-secret-key-change-in-production

# Contract Configuration (Optional)
CONTRACT_ADDRESS=

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
EOF

echo "✅ .env file updated!"
echo ""

# Database connection test
echo "🔍 Testing database connection..."
PGPASSWORD=${DB_PASS} psql -U postgres -h localhost -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed!"
    echo "Please check:"
    echo "  1. PostgreSQL is running: sudo systemctl status postgresql"
    echo "  2. Password is correct"
    echo "  3. User 'postgres' exists"
    exit 1
fi

echo ""

# Database exists check करें
echo "🔍 Checking if database 'zotrust' exists..."
PGPASSWORD=${DB_PASS} psql -U postgres -h localhost -lqt | cut -d \| -f 1 | grep -qw zotrust

if [ $? -ne 0 ]; then
    echo "📦 Creating database 'zotrust'..."
    PGPASSWORD=${DB_PASS} createdb -U postgres -h localhost zotrust
    echo "✅ Database created!"
else
    echo "✅ Database already exists!"
fi

echo ""
echo "🔄 Running migrations..."
echo ""

# start_time column migration
echo "1️⃣  Adding start_time column..."
if [ -f "add-start-time-column.sql" ]; then
    PGPASSWORD=${DB_PASS} psql -U postgres -h localhost -d zotrust -f add-start-time-column.sql
    echo "✅ start_time column added!"
else
    echo "⚠️  add-start-time-column.sql not found, skipping..."
fi

# timezone fields migration
echo "2️⃣  Adding timezone and start_datetime_string columns..."
if [ -f "add-timezone-fields.sql" ]; then
    PGPASSWORD=${DB_PASS} psql -U postgres -h localhost -d zotrust -f add-timezone-fields.sql
    echo "✅ Timezone fields added!"
else
    echo "⚠️  add-timezone-fields.sql not found, skipping..."
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "You can now start the backend server with:"
echo "  npm start"
echo ""

