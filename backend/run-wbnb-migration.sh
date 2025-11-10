#!/bin/bash

# WBNB Token Migration Script
# This script updates the database to allow WBNB token

echo "🚀 Running WBNB Token Migration..."
echo ""

# Run the migration
psql -U postgres -d zotrust -f migrations/add-wbnb-token.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ WBNB token migration completed successfully!"
    echo ""
    echo "🎉 You can now use WBNB in your platform!"
    echo ""
    echo "Next steps:"
    echo "1. Restart backend: npm start"
    echo "2. Reload frontend: Ctrl+Shift+R"
    echo "3. Create WBNB ads and start trading!"
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    echo ""
    echo "You can manually run:"
    echo "psql -U postgres -d zotrust -f migrations/add-wbnb-token.sql"
fi

