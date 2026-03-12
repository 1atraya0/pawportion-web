# 🚀 Windows Quick Start Guide

## Step 1: Install Node.js

1. Download from https://nodejs.org/ (LTS version recommended)
2. Run the installer and follow the prompts
3. Open PowerShell/Command Prompt and verify:
   ```
   node --version
   npm --version
   ```

## Step 2: Start the Backend

1. Open PowerShell in the `pawportion-web\backend` folder
2. Run these commands:
   ```powershell
   npm install
   npm start
   ```
3. You should see:
   ```
   🐾 Pawportion Backend running on port 5000
   ```

## Step 3: Open the Frontend

### Option A: Using Node.js HTTP Server (Easiest)
1. Open another PowerShell in the `pawportion-web\frontend` folder
2. Install http-server (one-time):
   ```powershell
   npm install -g http-server
   ```
3. Start the server:
   ```powershell
   http-server
   ```
4. Open your browser to `http://localhost:8080`

### Option B: Direct File Open
1. Navigate to `pawportion-web\frontend`
2. Right-click `index.html` → Open with → Your browser
3. ⚠️ Some features may not work due to browser security restrictions

### Option C: Python Server
If you have Python installed:
```powershell
python -m http.server 8000
```
Then open `http://localhost:8000`

## Step 4: Configure ESP32

1. **Find Your Computer's IP:**
   - Open Command Prompt
   - Type: `ipconfig`
   - Find "IPv4 Address" (usually looks like 192.168.x.x)

2. **Update Arduino Code** (`pawportion_feeder.ino`):
   - Line 6: Change WiFi name
   - Line 7: Change WiFi password
   - Line 21: Change to your computer's IP

3. **Flash to ESP32:**
   - Open Arduino IDE
   - Paste the code
   - Select ESP32 board
   - Select COM port
   - Click Upload

4. **Find ESP32's IP:**
   - Open Arduino Serial Monitor (Tools → Serial Monitor)
   - Set baud rate to 115200
   - The IP will be printed when it connects

## Step 5: Connect Everything

1. **Start Backend**: Make sure the backend is still running
2. **Open Frontend**: Open the web interface in your browser
3. **Configure Device IP**:
   - In the web UI, go to "⚙️ Device Settings"
   - Enter your ESP32's IP address
   - Click "Update"

4. **Test the Connection**:
   - The status indicator should show "Connected" ✅
   - Try the "Test Sound" button
   - If everything works, you're all set!

## Keeping Things Running

### Background Servers

**Option 1: Using Terminal Windows**
- Keep both backend and frontend terminal windows open
- Don't close them while using the system

**Option 2: Using Windows Task Scheduler**
1. Create a batch file: `start-backend.bat`
   ```batch
   @echo off
   cd path\to\pawportion-web\backend
   npm start
   ```
2. Schedule it to run at startup via Task Scheduler

**Option 3: Using PM2 (Advanced)**
```powershell
npm install -g pm2
cd path\to\pawportion-web\backend
pm2 start server.js
pm2 startup
pm2 save
```

## Common Windows Issues & Solutions

### "npm is not recognized"
- NodeJS didn't install properly
- Restart your computer after installing Node
- Add Node to PATH manually if needed

### Port 5000 Already in Use
```powershell
# Find what's using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with the number shown)
taskkill /PID <PID> /F
```

### CORS Error in Browser Console
- Make sure the backend is running
- Check that API_BASE_URL in `script.js` matches your backend URL
- Try accessing `http://localhost:5000/health` in browser

### Can't Access http://localhost:8000
- Make sure you started the http-server
- Try a different port: `http-server -p 8080`
- Check Windows Firewall isn't blocking the port

### ESP32 Keeps Disconnecting
- Try a WiFi closer to the router
- Reduce distance from router
- Check WiFi credentials are correct
- Restart the ESP32

## File Paths (Copy-Paste Ready)

```
Frontend folder:
C:\Users\atray\Desktop\audrino project\pawportion-web\frontend

Backend folder:
C:\Users\atray\Desktop\audrino project\pawportion-web\backend

Arduino file:
C:\Users\atray\Desktop\audrino project\pawportion-web\pawportion_feeder.ino
```

## Essential Commands

```powershell
# Go to backend folder
cd "C:\Users\atray\Desktop\audrino project\pawportion-web\backend"

# Install dependencies
npm install

# Start backend
npm start

# Go to frontend folder
cd "C:\Users\atray\Desktop\audrino project\pawportion-web\frontend"

# Start frontend server
http-server

# Or with Python
python -m http.server 8000
```

## Keyboard Shortcuts

Once your device is connected:

| Key | Action |
|-----|--------|
| **Spacebar** | Start feeding |
| **1-9** | Select tone 1-9 |
| **0** | Select tone 10 |

## Testing Checklist

- [ ] Backend running (`npm start` shows "running on port 5000")
- [ ] Frontend accessible (can see the web page)
- [ ] Status shows "Connected" ✅
- [ ] Can slide the food amount slider
- [ ] Can adjust volume slider
- [ ] Can select different tones
- [ ] "Test Sound" button plays audio from DFPlayer Mini
- [ ] "START FEEDING" button works
- [ ] Servo moves and dispenses food
- [ ] Status updates show current values

## Still Having Issues?

1. **Check the README.md** - Full troubleshooting guide
2. **Arduino Serial Monitor** - Shows ESP32 debug messages
3. **Browser Developer Tools** (F12) - Shows JavaScript errors
4. **Backend Console** - Shows server errors

---

**You're all set! Enjoy your automated pet feeder! 🐾**
