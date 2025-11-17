#!/bin/bash

# =============================================
# Zotrust P2P Platform - VPS Quick Setup Script
# =============================================
# This script automates the initial VPS setup
# Run with: bash vps_quick_setup.sh
# =============================================

set -e  # Exit on error

echo "🚀 Starting Zotrust P2P Platform VPS Setup..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run as root. Use a regular user with sudo privileges."
    exit 1
fi

# Step 1: Update System
print_info "Step 1: Updating system..."
sudo apt update && sudo apt upgrade -y
print_success "System updated"

# Step 2: Install PostgreSQL
print_info "Step 2: Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    sudo apt install postgresql postgresql-contrib -y
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    print_success "PostgreSQL installed"
else
    print_info "PostgreSQL already installed"
fi

# Step 3: Get database credentials
echo ""
print_info "Step 3: Database Configuration"
read -p "Enter database name (default: p2p_dapp): " DB_NAME
DB_NAME=${DB_NAME:-p2p_dapp}

read -p "Enter database username (default: p2p_user): " DB_USER
DB_USER=${DB_USER:-p2p_user}

read -sp "Enter database password: " DB_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ]; then
    print_error "Password cannot be empty"
    exit 1
fi

# Step 4: Create Database and User
print_info "Step 4: Creating database and user..."
sudo -u postgres psql <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
EOF

print_success "Database '$DB_NAME' and user '$DB_USER' created"

# Step 5: Check if schema file exists
print_info "Step 5: Importing database schema..."
if [ ! -f "VPS_DATABASE_SCHEMA.sql" ]; then
    print_error "VPS_DATABASE_SCHEMA.sql not found in current directory"
    print_info "Please place the schema file in: $(pwd)"
    exit 1
fi

# Import schema
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f VPS_DATABASE_SCHEMA.sql

if [ $? -eq 0 ]; then
    print_success "Database schema imported successfully"
else
    print_error "Failed to import schema"
    exit 1
fi

# Step 6: Verify tables
print_info "Step 6: Verifying database tables..."
TABLE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

if [ "$TABLE_COUNT" -ge "19" ]; then
    print_success "Database has $TABLE_COUNT tables (expected 19+)"
else
    print_error "Database has only $TABLE_COUNT tables (expected 19+)"
    exit 1
fi

# Step 7: Install Node.js
print_info "Step 7: Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installed"
else
    NODE_VERSION=$(node --version)
    print_info "Node.js already installed: $NODE_VERSION"
fi

# Step 8: Install PM2
print_info "Step 8: Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    print_success "PM2 installed"
else
    print_info "PM2 already installed"
fi

# Step 9: Setup Firewall
print_info "Step 9: Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw --force enable
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 5000/tcp  # Backend API
    print_success "Firewall configured"
else
    print_info "UFW not available, skipping firewall setup"
fi

# Step 10: Create .env file template
print_info "Step 10: Creating .env template..."
cat > .env.template <<EOF
# Database
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Blockchain (UPDATE THESE!)
BSC_RPC_URL=https://bsc-dataseed.binance.org/
CONTRACT_ADDRESS=0x02ADD84281025BeeB807f5b94Ea947599146ca00
RELAYER_PRIVATE_KEY=your_private_key_here

# Server
PORT=5000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_JWT_SECRET=$(openssl rand -hex 32)

# IPFS
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_GATEWAY=https://ipfs.io/ipfs/
EOF

print_success ".env.template created"

# Step 11: Create backup script
print_info "Step 11: Creating backup script..."
mkdir -p ~/backups

cat > ~/backup_db.sh <<EOF
#!/bin/bash
BACKUP_DIR="\$HOME/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR
PGPASSWORD=$DB_PASSWORD pg_dump -h localhost -U $DB_USER $DB_NAME > \$BACKUP_DIR/${DB_NAME}_backup_\$DATE.sql
# Keep only last 7 days
find \$BACKUP_DIR -name "${DB_NAME}_backup_*.sql" -mtime +7 -delete
echo "Backup completed: \$BACKUP_DIR/${DB_NAME}_backup_\$DATE.sql"
EOF

chmod +x ~/backup_db.sh
print_success "Backup script created at ~/backup_db.sh"

# Step 12: Test database connection
print_info "Step 12: Testing database connection..."
if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Database connection successful"
else
    print_error "Database connection failed"
    exit 1
fi

# Step 13: Display summary
echo ""
echo "=============================================="
echo "✅ VPS Setup Complete!"
echo "=============================================="
echo ""
echo "📊 Setup Summary:"
echo "  - Database Name: $DB_NAME"
echo "  - Database User: $DB_USER"
echo "  - Database Port: 5432"
echo "  - Tables Created: $TABLE_COUNT"
echo "  - Backup Script: ~/backup_db.sh"
echo ""
echo "📝 Next Steps:"
echo "  1. Copy .env.template to your backend folder:"
echo "     cp .env.template /path/to/backend/.env"
echo ""
echo "  2. Edit .env and update blockchain settings:"
echo "     nano /path/to/backend/.env"
echo ""
echo "  3. Install project dependencies:"
echo "     cd /path/to/project && npm install"
echo ""
echo "  4. Build frontend:"
echo "     cd frontend && npm run build"
echo ""
echo "  5. Start backend with PM2:"
echo "     cd backend && pm2 start npm --name 'p2p-backend' -- start"
echo ""
echo "  6. Setup auto-backup (optional):"
echo "     crontab -e"
echo "     Add: 0 2 * * * ~/backup_db.sh"
echo ""
echo "📚 Full documentation: VPS_SETUP_GUIDE.md"
echo ""
echo "🎉 Happy deploying!"
echo "=============================================="

