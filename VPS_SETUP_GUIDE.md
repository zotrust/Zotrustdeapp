# 🚀 VPS Deployment Guide - Zotrust P2P Platform

## 📋 Prerequisites

- VPS with Ubuntu 20.04+ or Debian 11+
- Minimum 2GB RAM, 2 CPU cores
- Root or sudo access
- Domain name (optional but recommended)

## 🛠️ Step 1: Install PostgreSQL

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

## 🔐 Step 2: Setup Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL prompt:
CREATE DATABASE p2p_dapp;
CREATE USER p2p_user WITH ENCRYPTED PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE p2p_dapp TO p2p_user;
\q

# Exit PostgreSQL
exit
```

## 📦 Step 3: Upload Schema File

```bash
# Option A: Using SCP from your local machine
scp VPS_DATABASE_SCHEMA.sql user@your-vps-ip:/home/user/

# Option B: Using wget/curl if file is on GitHub
cd /home/user/
wget https://your-repo/VPS_DATABASE_SCHEMA.sql

# Option C: Copy-paste using nano
nano VPS_DATABASE_SCHEMA.sql
# Paste the content and save (Ctrl+X, Y, Enter)
```

## 🗄️ Step 4: Run Schema File

```bash
# Method 1: Using psql (recommended)
psql -U postgres -d p2p_dapp -f VPS_DATABASE_SCHEMA.sql

# Method 2: If prompted for password
psql -h localhost -U p2p_user -d p2p_dapp -f VPS_DATABASE_SCHEMA.sql

# Verify tables created successfully
psql -U postgres -d p2p_dapp -c "\dt"
```

## ✅ Step 5: Verify Database Setup

```bash
# Connect to database
psql -U postgres -d p2p_dapp

# Inside psql:
\dt                    -- List all tables
\d orders             -- Describe orders table
\d disputes           -- Describe disputes table
SELECT * FROM locations;  -- Check default locations
SELECT * FROM app_settings; -- Check default settings
\q                    -- Exit
```

## 📊 Expected Tables (19 total):

```
1.  locations
2.  users
3.  agents
4.  ads
5.  orders
6.  otp_logs
7.  transactions
8.  payment_confirmations
9.  disputes
10. appeals
11. dispute_timeline
12. admin_notifications
13. reviews
14. calls
15. audit_logs
16. support
17. admin_users
18. app_settings
19. chat_messages
```

## 🔧 Step 6: Configure PostgreSQL for Remote Access (Optional)

If you need to access database from external tools:

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and modify:
listen_addresses = '*'

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add this line:
host    all             all             0.0.0.0/0               md5

# Restart PostgreSQL
sudo systemctl restart postgresql

# Open firewall (if UFW is enabled)
sudo ufw allow 5432/tcp
```

## 🚨 Security Recommendations

### 1. **Database Password**
```bash
# Change default password
psql -U postgres
ALTER USER p2p_user WITH PASSWORD 'new_super_strong_password';
\q
```

### 2. **Firewall Setup**
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (only if needed externally)
sudo ufw allow 5432/tcp

# Check status
sudo ufw status
```

### 3. **Backup Strategy**
```bash
# Create backup script
nano /home/user/backup_db.sh
```

Add this content:
```bash
#!/bin/bash
BACKUP_DIR="/home/user/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U postgres p2p_dapp > $BACKUP_DIR/p2p_dapp_backup_$DATE.sql
# Keep only last 7 days
find $BACKUP_DIR -name "p2p_dapp_backup_*.sql" -mtime +7 -delete
```

```bash
# Make executable
chmod +x /home/user/backup_db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/user/backup_db.sh
```

## 🔗 Step 7: Environment Variables

Create `.env` file for your backend:

```bash
nano /path/to/your/backend/.env
```

Add:
```env
# Database
DATABASE_URL=postgresql://p2p_user:your_password@localhost:5432/p2p_dapp
DB_HOST=localhost
DB_PORT=5432
DB_NAME=p2p_dapp
DB_USER=p2p_user
DB_PASSWORD=your_password

# Blockchain
BSC_RPC_URL=https://bsc-dataseed.binance.org/
CONTRACT_ADDRESS=0x02ADD84281025BeeB807f5b94Ea947599146ca00
RELAYER_PRIVATE_KEY=your_private_key_here

# Server
PORT=5000
NODE_ENV=production
JWT_SECRET=your_jwt_secret_here
ADMIN_JWT_SECRET=your_admin_jwt_secret_here

# IPFS (for evidence uploads)
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_GATEWAY=https://ipfs.io/ipfs/
```

## 📝 Step 8: Install Node.js & Dependencies

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 for process management
sudo npm install -g pm2

# Navigate to your project
cd /path/to/your/project

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

## 🚀 Step 9: Build & Start Application

```bash
# Build frontend
cd frontend
npm run build

# Start backend with PM2
cd ../backend
pm2 start npm --name "p2p-backend" -- start

# Check status
pm2 status
pm2 logs p2p-backend

# Auto-restart on reboot
pm2 startup
pm2 save
```

## 🔍 Troubleshooting

### Connection Refused
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if port is listening
sudo netstat -tunlp | grep 5432

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Permission Denied
```bash
# Grant permissions to p2p_user
psql -U postgres -d p2p_dapp
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO p2p_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO p2p_user;
\q
```

### Schema Already Exists
```bash
# Drop and recreate (⚠️ WARNING: Deletes all data!)
psql -U postgres -d p2p_dapp -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# Then run schema file again
psql -U postgres -d p2p_dapp -f VPS_DATABASE_SCHEMA.sql
```

## 📊 Monitoring

```bash
# Check database size
psql -U postgres -d p2p_dapp -c "SELECT pg_size_pretty(pg_database_size('p2p_dapp'));"

# Check table sizes
psql -U postgres -d p2p_dapp -c "
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check active connections
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'p2p_dapp';"
```

## 🎯 Post-Deployment Checklist

- [ ] Database schema created successfully
- [ ] All 19 tables exist
- [ ] Default locations inserted
- [ ] Default app_settings inserted
- [ ] Admin user created (via API endpoint)
- [ ] Agents added through admin panel
- [ ] Environment variables configured
- [ ] Backend running via PM2
- [ ] Frontend built and served
- [ ] Firewall configured
- [ ] Backup cron job configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Domain configured
- [ ] Monitoring setup (optional)

## 🆘 Support

If you encounter issues:

1. Check logs: `pm2 logs p2p-backend`
2. Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`
3. Verify database connection: `psql -U postgres -d p2p_dapp`
4. Check firewall: `sudo ufw status`
5. Check process: `pm2 status`

## 📚 Additional Resources

- PostgreSQL Docs: https://www.postgresql.org/docs/
- PM2 Docs: https://pm2.keymetrics.io/
- Node.js Docs: https://nodejs.org/docs/

---

**✅ Setup Complete!** Your database is ready for production use.

