# ⚡ Quick Start - Database Integration

This is a simplified getting-started guide. For detailed info, see `DB_SETUP.md`.

## 5-Minute Setup

### Step 1: Install Dependencies (1 minute)
```bash
cd backend
npm install
```

### Step 2: Create Database Tables (2 minutes)
```bash
node setup-db.js
```

Expected output:
```
✅ Database setup completed successfully!
```

### Step 3: Start Backend (1 minute)
```bash
npm start
```

Expected output:
```
🐾 Pawportion Backend running on port 5000
📡 ESP32 IP: 192.168.1.100
✅ Device settings loaded from database
```

### Step 4: Open Frontend (1 minute)

In another terminal:
```bash
cd frontend
npx http-server
```

Open browser: `http://localhost:8080`

## ✅ You're Done!

Now:
- All feedings are logged to the database
- Settings are saved automatically
- Statistics are calculated automatically
- Everything persists even if you restart!

## 🐛 Quick Troubleshooting

**Backend won't start:**
```bash
npm install
npm start
```

**Database connection failed:**
- Check `.env` file has correct credentials
- Verify internet connection works
- Try `node setup-db.js` again

**Tables already exist error:**
- This is fine! Just means they're already set up
- You're ready to start the backend

## 📊 What's Stored?

Every time you use the feeder:
- ✅ Feeding time and amount
- ✅ Sound tone used
- ✅ Device IP and status
- ✅ All settings changes
- ✅ Complete activity log

## 🔍 Viewing Your Data

Open Supabase dashboard:
https://app.supabase.com

Navigate to "SQL Editor" and run:
```sql
SELECT * FROM feeding_logs ORDER BY timestamp DESC LIMIT 10;
```

## 🚀 Commands Reference

```bash
# Install dependencies
npm install

# Create database tables
node setup-db.js

# Start backend server
npm start

# Start frontend server (separate terminal)
npx http-server

# View database tables
psql postgresql://postgres:Pawportion@123@db.emgguysqsghukjuaqgev.supabase.co:5432/postgres
```

## 📱 Features Now Available

- 📈 Daily feeding statistics
- 📊 Weekly trends
- 📋 Complete feeding history
- 🔔 Device status tracking
- 📝 Activity logging
- ⏰ Feeding schedules
- 📱 Mobile-friendly dashboard

## 🎯 What Happens Next?

1. Backend stores all data in database
2. Frontend loads and displays data
3. Statistics calculate automatically
4. Everything syncs in real-time
5. Data persists forever

## 💡 Tips

- Keep backend terminal open while using feeder
- Check database regularly at Supabase dashboard
- Export data anytime for backup
- Add multiple feeders with different device IDs

## 📞 Need Help?

1. See `DB_SETUP.md` for detailed guide
2. Check `README.md` for full documentation
3. Verify credentials in `.env`
4. Check Node.js console for error messages

---

**Done! Your feeder is now connected to the cloud! 🐾☁️**
