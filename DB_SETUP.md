# 🗄️ Database Setup Guide - Pawportion Pet Feeder

This guide will walk you through setting up your Supabase PostgreSQL database and connecting it to the Pawportion pet feeder system.

## 📋 Prerequisites

Before you start, you need:
- Supabase account (https://supabase.com/) - free tier available
- Node.js installed on your computer
- Your Pawportion project files
- Database credentials:
  - **Database URL**: `postgresql://postgres:Pawportion@123@db.emgguysqsghukjuaqgev.supabase.co:5432/postgres`
  - **Password**: `Pawportion@123`

## 🚀 Step 1: Database Configuration

### Option A: Already Configured (Recommended)

The database is already configured in your `.env` file:

```env
PORT=5000
ESP32_IP=192.168.1.100
DATABASE_URL=postgresql://postgres:Pawportion@123@db.emgguysqsghukjuaqgev.supabase.co:5432/postgres
DB_HOST=db.emgguysqsghukjuaqgev.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=Pawportion@123
DB_NAME=postgres
```

✅ No action needed - credentials are already in place!

### Option B: Update Configuration (If needed)

If you want to use a different database or credentials:

1. Open `backend/.env`
2. Update the database connection details:
   ```env
   DATABASE_URL=your_database_url
   DB_HOST=your_host
   DB_USER=your_user
   DB_PASSWORD=your_password
   ```

## 🔧 Step 2: Install Dependencies

1. Open PowerShell in the `backend` folder:
   ```bash
   cd "C:\Users\atray\Desktop\audrino project\pawportion-web\backend"
   ```

2. Install required packages:
   ```bash
   npm install
   ```

   This installs:
   - `express` - Web server framework
   - `pg` - PostgreSQL client
   - `cors` - Cross-origin support
   - `dotenv` - Environment variables
   - `axios` - HTTP requests

## 📊 Step 3: Initialize Database Schema

Once npm packages are installed, run the setup script to create all tables:

```bash
node setup-db.js
```

You should see output like:
```
🔧 Starting database setup...
📋 Found 32 SQL statements to execute
✅ Statement 1/32 executed
✅ Statement 2/32 executed
...
✅ Database setup completed successfully!
📊 Tables created:
   - device_settings
   - feeding_logs
   - device_status_logs
   - feeding_schedules
   - user_preferences
   - activity_logs
   - api_tokens
   - alerts

🎉 Ready to use!
```

**What gets created:**
- `device_settings` - Stores feeder configuration
- `feeding_logs` - Records every feeding event
- `device_status_logs` - Tracking online/offline status
- `feeding_schedules` - Automated feeding times
- `user_preferences` - UI settings
- `activity_logs` - Complete audit trail
- `api_tokens` - API access tokens
- `alerts` - System notifications

## 🌐 Step 4: Start the Backend Server

In the same PowerShell window:

```bash
npm start
```

You should see:
```
🐾 Pawportion Backend running on port 5000
📡 ESP32 IP: 192.168.1.100
🔧 Device ID: pawportion-001
✅ Device settings loaded from database
```

**Keep this terminal open!** The backend must be running for the web interface to work.

## 🎨 Step 5: Open the Frontend

In a new PowerShell window, go to the frontend folder:

```bash
cd "C:\Users\atray\Desktop\audrino project\pawportion-web\frontend"
npx http-server
```

Then open your browser to the URL shown (usually `http://localhost:8080`)

## 📈 What Gets Stored in the Database

### 1. Device Settings
Every time you change a setting in the web interface:
- Food amount
- Selected tone
- Volume level
- Device IP address

### 2. Feeding Logs
Every time your feeder dispenses food:
- Date and time
- Amount dispensed
- Sound tone used
- Status (started, completed, or failed)
- Duration

### 3. Device Status
The system automatically logs:
- When device comes online/goes offline
- Device IP address
- Last response time

### 4. Activity Log
Complete record of all actions:
- Device IP changes
- Settings modifications
- Schedule creation/updates
- Test sound plays
- And more...

### 5. Analytics Views
Automatic calculations:
- Daily feeding statistics
- Weekly totals
- Average portions per feeding
- Device uptime/downtime

## 🔍 Viewing Your Data

### From Your Code

You can query the data programmatically:

```javascript
// Get all feeding logs
const logs = await db.getFeedingLogs('pawportion-001', 50);

// Get statistics
const stats = await db.getFeedingStats('pawportion-001', 7);

// Get device settings
const settings = await db.getDeviceSettings('pawportion-001');
```

### From Supabase Dashboard

1. Log in to Supabase (https://app.supabase.com)
2. Select your project
3. Go to "SQL Editor"
4. Run queries like:

```sql
-- View all feeding logs
SELECT * FROM feeding_logs ORDER BY timestamp DESC LIMIT 50;

-- View today's feeding summary
SELECT COUNT(*) as feedings, SUM(food_amount) as total_food
FROM feeding_logs 
WHERE DATE(timestamp) = CURRENT_DATE;

-- View activity log
SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100;

-- View device settings
SELECT * FROM device_settings;
```

## 📊 Database Schema Overview

### device_settings
```
id              INTEGER PRIMARY KEY
device_id       VARCHAR(50) UNIQUE
food_amount     INTEGER (default: 5)
selected_tone   INTEGER (default: 1)
volume_level    INTEGER (default: 25)
device_ip       VARCHAR(20)
is_active       BOOLEAN
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### feeding_logs
```
id              INTEGER PRIMARY KEY
device_id       VARCHAR(50) FOREIGN KEY
food_amount     INTEGER
selected_tone   INTEGER
status          VARCHAR(20) - 'started', 'completed', 'failed'
duration        INTEGER (milliseconds)
error_message   TEXT (if failed)
timestamp       TIMESTAMP
```

### device_status_logs
```
id              INTEGER PRIMARY KEY
device_id       VARCHAR(50) FOREIGN KEY
is_online       BOOLEAN
ip_address      VARCHAR(20)
last_response   TIMESTAMP
timestamp       TIMESTAMP
```

### feeding_schedules
```
id              INTEGER PRIMARY KEY
device_id       VARCHAR(50) FOREIGN KEY
scheduled_time  TIME (HH:MM format)
food_amount     INTEGER
days            VARCHAR(100) (e.g., "1,2,3,4,5")
enabled         BOOLEAN
last_executed   TIMESTAMP
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

## 🐛 Troubleshooting

### "Cannot connect to database"
```
Error: connect ECONNREFUSED
```
**Solution:**
1. Check your database credentials in `.env`
2. Verify the database host is correct
3. Check if your internet is working
4. Verify the database is running in Supabase

### "Tables don't exist"
```
Error: relation "device_settings" does not exist
```
**Solution:**
1. Run `node setup-db.js` again
2. Check for error messages in the output
3. Verify your database credentials

### "Migrations failed"
```
Error: Already exists
```
**Solution:**
- This is normal! It means the tables were already created
- The script skips already existing tables

### Backend starts but no data appears
```
Device settings loaded from database: false
```
**Solution:**
1. Verify setup-db.js ran successfully
2. Run a manual SQL query to check tables exist
3. Check that the device_id matches in all queries

## 🔄 API Endpoints (Now with Database!)

All endpoints now automatically save to the database:

```
POST /api/feed                    - Logs feeding start
POST /api/food-amount            - Saves food amount
POST /api/tone                   - Saves tone selection
POST /api/volume                 - Saves volume level
POST /api/play-sound             - Logs test sound
GET  /api/feeding/logs           - Retrieves feeding history
GET  /api/feeding/stats          - Gets statistics
GET  /api/status/history         - Gets status changes
GET  /api/activity/logs          - Gets activity log
GET  /api/dashboard              - Full dashboard data
```

## 💾 Backup Your Data

### Manual Backup
1. Go to Supabase dashboard
2. Click "Backups"
3. Click "Back up now"
4. Save the backup file

### Automated Backups
Supabase automatically backs up your data daily on paid plans.

### Export Data
```sql
-- Export feeding logs as CSV
SELECT * FROM feeding_logs 
ORDER BY timestamp DESC;
```

Then copy/paste into Excel or use Supabase's export feature.

## 🔒 Security Notes

**Keep These Safe:**
- ❌ Never commit `.env` to Git
- ❌ Never share your database password
- ❌ Never expose credentials in client code
- ✅ Always use HTTPS for internet access
- ✅ Use firewall rules in Supabase

## 📱 Access from Phone

Once database is working, you can:
1. Check feeding history from anywhere
2. View statistics and graphs
3. Monitor device status remotely
4. Manual feedings from mobile

## 🎯 Next Steps

1. ✅ Database configured
2. ✅ Schema created
3. ✅ Backend running
4. ➡️ Start the frontend
5. ➡️ Configure ESP32 IP
6. ➡️ Test feeding and watch data appear!

## ❓ FAQ

**Q: Will my data be lost if I restart?**
A: No! Everything is stored in Supabase. Your data persists forever.

**Q: Can I have multiple feeders?**
A: Yes! Each feeder gets a unique `device_id` and separate logs.

**Q: How much data can I store?**
A: Supabase free tier: 500MB. Paid plans have much more.

**Q: Can I export my data?**
A: Yes! Export to CSV/JSON from Supabase dashboard anytime.

**Q: Is my data safe?**
A: Yes! Supabase uses enterprise-grade PostgreSQL security.

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Look at Node.js console errors
3. Check Supabase dashboard status
4. Verify all credentials are correct

---

**You're all set! Your pet feeder data is now stored securely in the cloud!** ☁️🐾
