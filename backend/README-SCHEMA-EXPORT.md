# Database Schema Export Guide

## �� Complete Schema Export from PostgreSQL Database

### Method 1: Using Shell Script (Recommended)

```bash
cd backend
./export-complete-schema.sh
```

The script will:
- Check if database exists
- Export complete schema + data
- Export schema only (structure)
- Export data only
- Generate timestamped files

### Method 2: Using Node.js Script

```bash
cd backend
node export-schema.js
```

### Method 3: Manual pg_dump Command

```bash
# Export complete database (schema + data)
pg_dump -U postgres -h localhost -d zotrust --clean --if-exists --no-owner --no-privileges -f zotrust-complete-schema.sql

# Export schema only (structure, no data)
pg_dump -U postgres -h localhost -d zotrust --schema-only --clean --if-exists --no-owner --no-privileges -f zotrust-schema-only.sql

# Export data only (no structure)
pg_dump -U postgres -h localhost -d zotrust --data-only --no-owner --no-privileges -f zotrust-data-only.sql
```

### Environment Variables

You can set these environment variables before running:

```bash
export DB_NAME=zotrust
export DB_USER=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_PASSWORD=your_password
```

### Restore Database from Export

```bash
# Create database first (if it doesn't exist)
createdb -U postgres -h localhost zotrust

# Restore from export file
psql -U postgres -h localhost -d zotrust -f zotrust-complete-schema.sql
```

### Files Generated

1. **zotrust-complete-schema-export-[timestamp].sql** - Complete database (schema + data)
2. **zotrust-schema-only-[timestamp].sql** - Schema structure only
3. **zotrust-data-only-[timestamp].sql** - Data only

### Notes

- All exports include `--clean` and `--if-exists` flags for safe restoration
- `--no-owner` and `--no-privileges` flags ensure portability
- Files are timestamped to prevent overwriting
