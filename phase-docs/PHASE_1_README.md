# Phase 1: Database Migration - Complete Guide

## 🎯 Goal
Migrate from in-memory storage (JavaScript Maps) to persistent PostgreSQL database.

## 📋 What You're Getting

### Files Created:
1. **db.js** - Database abstraction layer with all CRUD operations
2. **index-v3-postgres.js** - Modified backend that uses PostgreSQL
3. **schema.sql** - Database schema with tables, indexes, triggers, views
4. **test-db.js** - Comprehensive test suite
5. **migrate-to-postgres.sh** - Automated migration script
6. **.env.example** - Environment variables template

## ⚡ Quick Start (Arch Linux)

### Option 1: Automated Setup (Recommended)
```bash
# 1. Make migration script executable
chmod +x migrate-to-postgres.sh

# 2. Run the migration script
./migrate-to-postgres.sh

# 3. Follow the on-screen instructions
```

### Option 2: Manual Setup

#### Step 1: Install PostgreSQL
```bash
# Install PostgreSQL
sudo pacman -S postgresql

# Initialize database cluster (first time only)
sudo -u postgres initdb -D /var/lib/postgres/data

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify it's running
sudo systemctl status postgresql
```

#### Step 2: Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# In psql, run:
CREATE DATABASE printkiosk;
CREATE USER printuser WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE printkiosk TO printuser;
\q
```

#### Step 3: Run Schema
```bash
# Connect to the database and run schema
psql -U printuser -d printkiosk -h localhost -f schema.sql
# Password: your_secure_password_here
```

#### Step 4: Setup Backend Files
```bash
cd /path/to/qr-wifi-printer

# Backup existing backend
cp backend/index.js backend/index.js.backup

# Copy new files
cp db.js backend/db.js
cp index-v3-postgres.js backend/index.js
cp test-db.js backend/test-db.js
cp schema.sql backend/schema.sql

# Install dependencies
cd backend
npm install pg dotenv
```

#### Step 5: Configure Environment
```bash
# Create .env file in backend directory
cat > backend/.env << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=printkiosk
DB_USER=printuser
DB_PASSWORD=your_secure_password_here

# Server Configuration
PORT=3001
SECRET_KEY=change-this-to-random-string

# CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,https://qr-wifi-printer.vercel.app,https://justpri.duckdns.org
EOF

# IMPORTANT: Edit .env and change DB_PASSWORD and SECRET_KEY
nano backend/.env
```

#### Step 6: Test Database Connection
```bash
cd backend
node test-db.js
```

You should see:
```
✅ Database connection successful
✓ All tests passed! Database is ready to use.
```

#### Step 7: Start Backend
```bash
cd backend
node index.js
```

You should see:
```
╔═══════════════════════════════════════════╗
║   DirectPrint Server V3 - Running         ║
║   Database: PostgreSQL ✅                 ║
║   Port: 3001                              ║
╚═══════════════════════════════════════════╝
```

## 🔍 Verify Everything Works

### Test 1: Check Server Status
```bash
curl http://localhost:3001/api/status
```

Expected response:
```json
{
  "server": "online",
  "database": "connected",
  "kiosks": 0,
  "jobs_pending": 0,
  "jobs_printing": 0
}
```

### Test 2: Check Database Tables
```bash
psql -U printuser -d printkiosk -h localhost
\dt  # List tables
SELECT * FROM jobs;  # Should be empty but exist
\q
```

### Test 3: Restart Server (Data Persistence Test)
```bash
# Stop server (Ctrl+C)
# Start again
node index.js

# Check status again - should still work
curl http://localhost:3001/api/status
```

## 📊 Database Schema Overview

### Tables Created:

#### 1. **users**
- Stores user information (ready for Phase 2 authentication)
- Fields: id, email, name, created_at

#### 2. **kiosks**
- Tracks all Raspberry Pi kiosks
- Fields: id, hostname, printer_name, status, last_seen, uptime, socket_id

#### 3. **jobs**
- Complete print job lifecycle
- Fields: id, user_id, kiosk_id, filename, pages, total_cost, status, payment_status, timestamps

### Indexes (for performance):
- Jobs by user_id, kiosk_id, status, created_at
- Kiosks by status, last_seen

### Views (for analytics):
- **active_jobs** - Currently active print jobs
- **kiosk_stats** - Statistics per kiosk

## 🔧 Troubleshooting

### Problem: "Connection refused"
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not, start it
sudo systemctl start postgresql
```

### Problem: "Authentication failed for user printuser"
```bash
# Edit PostgreSQL authentication config
sudo nano /var/lib/postgres/data/pg_hba.conf

# Change this line:
# local   all   all   peer
# To:
local   all   all   md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Problem: "Database printkiosk does not exist"
```bash
# Recreate database
sudo -u postgres psql
CREATE DATABASE printkiosk;
\q
```

### Problem: "Test fails on foreign key constraint"
```bash
# Drop and recreate tables
psql -U printuser -d printkiosk -h localhost

DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS kiosks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

\i schema.sql
\q
```

### Problem: "Module 'pg' not found"
```bash
cd backend
npm install pg dotenv
```

## 🎓 Understanding the Changes

### Before (In-Memory):
```javascript
const jobs = new Map();
jobs.set(jobId, job);  // ❌ Data lost on restart
```

### After (PostgreSQL):
```javascript
const job = await db.createJob({...});  // ✅ Persisted to database
```

### Key Improvements:
✅ **Data Persistence** - Survives server restarts  
✅ **Query Capabilities** - Filter, sort, aggregate data  
✅ **Concurrent Access** - Multiple servers can share same database  
✅ **Audit Trail** - Track all state changes with timestamps  
✅ **Scalability** - Can handle thousands of jobs  

## 📁 File Structure After Migration

```
backend/
├── index.js              # NEW: PostgreSQL-backed server
├── index.js.backup       # Your original file (safe!)
├── db.js                 # NEW: Database abstraction layer
├── test-db.js            # NEW: Test suite
├── schema.sql            # NEW: Database schema
├── .env                  # NEW: Environment variables
├── package.json
├── uploads/              # Still used for files
└── node_modules/
```

## 🚀 Next Steps (Phase 2)

Once Phase 1 is complete and working:
1. ✅ Database is persistent
2. ✅ All operations use PostgreSQL
3. ✅ Tests pass

Then move to **Phase 2: Authentication** (Google OAuth)

## 💾 Backup & Recovery

### Backup Database:
```bash
pg_dump -U printuser -d printkiosk -h localhost > backup.sql
```

### Restore Database:
```bash
psql -U printuser -d printkiosk -h localhost < backup.sql
```

### Export Data as CSV:
```bash
psql -U printuser -d printkiosk -h localhost -c "COPY jobs TO STDOUT WITH CSV HEADER" > jobs.csv
```

## 🔐 Security Notes

### Development (Local):
- Password in .env: `dev_password_change_in_prod`
- This is fine for local development

### Production (Oracle VM):
- **MUST** use strong password: `openssl rand -base64 32`
- Set proper PostgreSQL permissions
- Use environment variables, never commit .env
- Enable SSL for database connections

## 📈 Performance Considerations

Current setup is optimized for:
- ~1000 jobs per day
- ~10 kiosks
- ~100 concurrent users

Indexes are created for common queries. If you need more performance:
- Add connection pooling (already configured, max 20)
- Add Redis for caching
- Use read replicas for analytics

## ❓ FAQ

**Q: Will my existing jobs be lost?**  
A: Yes, in-memory jobs will be lost. But going forward, all data persists.

**Q: Can I roll back if something breaks?**  
A: Yes! Your original `index.js` is backed up as `index.js.backup`

**Q: Do I need to change the Pi agent?**  
A: No! The Pi agent works exactly the same.

**Q: Do I need to change the frontend?**  
A: No! API endpoints remain the same.

**Q: What about Oracle VM?**  
A: After testing locally, you'll deploy the same setup to Oracle VM (Ubuntu commands slightly different)

## 🆘 Getting Help

If you encounter issues:
1. Check the error message in terminal
2. Run `node test-db.js` to diagnose
3. Check PostgreSQL logs: `sudo journalctl -u postgresql -n 50`
4. Share the specific error and I'll help debug

## ✅ Success Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `printkiosk` created
- [ ] User `printuser` created with correct password
- [ ] Schema applied successfully (tables exist)
- [ ] Backend files copied and dependencies installed
- [ ] `.env` file created with correct credentials
- [ ] `node test-db.js` passes all tests
- [ ] Server starts without errors
- [ ] `curl http://localhost:3001/api/status` returns JSON
- [ ] Data persists after server restart

---

**Ready to begin?** Start with the Quick Start section above! 🚀
