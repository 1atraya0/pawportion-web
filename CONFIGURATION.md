# 🔧 Configuration Guide

## Overview
This guide helps you configure the Pawportion system by setting the correct IP addresses for your computer and ESP32.

## Step-by-Step Configuration

### 1. Find Your Computer's IP Address

#### Windows:
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter. It should look like:
- `192.168.x.x`
- `10.0.x.x`
- `172.16-31.x.x`

**Example Output:**
```
Ethernet adapter Ethernet:
   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 192.168.1.5
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1
```

Write down your IP: `__________________`

#### Mac:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

#### Linux:
```bash
hostname -I
```

### 2. Update Arduino Code

**File:** `pawportion_feeder.ino` (Lines 5-21)

```cpp
// WiFi Configuration
const char* ssid = "your_wifi_name";           // ← Update this
const char* password = "your_wifi_password";   // ← Update this

// Backend Configuration
const char* backendIP = "192.168.1.5";         // ← Update this
const int backendPort = 5000;
```

**Example Configuration:**
```cpp
const char* ssid = "Home WiFi";
const char* password = "MyPassword123!";
const char* backendIP = "192.168.1.5";  // Your computer's IP from Step 1
```

### 3. Update Backend Configuration

**File:** `backend/.env`

```env
PORT=5000
ESP32_IP=192.168.1.100  # ← Leave as default, will update in web UI
```

The `ESP32_IP` here is just a default. You'll find the actual IP in the next steps.

### 4. Flash Arduino Code to ESP32

1. Open Arduino IDE
2. Paste the code from `pawportion_feeder.ino`
3. Select your ESP32 board (Tools → Board → ESP32 Dev Module)
4. Select the COM port (Tools → Port)
5. Click Upload

### 5. Find Your ESP32's IP Address

**Method 1: Serial Monitor (Easiest)**

1. Keep the Arduino IDE open after uploading
2. Go to Tools → Serial Monitor
3. Set baud rate to **115200** (bottom right)
4. Look for a line like: `✓ Connected! IP: 192.168.1.100`

Write down the ESP32 IP: `__________________`

**Method 2: Router's Admin Panel**

1. Open your router's admin panel (usually http://192.168.1.1)
2. Look for "Connected Devices" or "DHCP Clients"
3. Find the device named like "ESP32" or "espressif"

**Method 3: Network Scanner**

Use a tool like:
- Angry IP Scanner (Windows/Mac/Linux)
- nmap (Linux/Mac)
- Advanced IP Scanner (Windows)

### 6. Update Web Interface

**How to configure in the web browser:**

1. Open the web interface (http://localhost:8000 or similar)
2. Click on "⚙️ Device Settings" section
3. In the "Device IP Address" field, enter your ESP32's IP
4. Click "Update"

Example:
```
Input: 192.168.1.100
Click: Update
Status: "Device IP updated to 192.168.1.100"
```

### 7. Verify Connection

Check if everything is working:

1. **Backend** is running
   ```bash
   npm start  # Should show: "🐾 Pawportion Backend running on port 5000"
   ```

2. **Frontend** is accessible
   - Open http://localhost:8000 in your browser
   - You should see the Pawportion interface

3. **Status Indicator**
   - Top right should show "Connected" in green ✅
   - If it shows "Offline", double-check the ESP32 IP

4. **Test Controls**
   - Try "Test Sound" button
   - Try "START FEEDING" button
   - Check if feeder responds

## Configuration File Reference

### Arduino Code Variables I need to change

| Variable | What It Is | Example | Where |
|----------|-----------|---------|-------|
| `ssid` | WiFi network name | "My Home WiFi" | Line 6 |
| `password` | WiFi password | "MyPassword123!" | Line 7 |
| `backendIP` | Your computer's IP | "192.168.1.5" | Line 21 |

### Backend Configuration

| Setting | What It Is | Default | Where |
|---------|-----------|---------|-------|
| `PORT` | Server port | 5000 | `.env` |
| `ESP32_IP` | Device IP address | 192.168.1.100 | `.env` (or update in web UI) |

### Web Interface

| Setting | What It Is | How to Configure |
|---------|-----------|-----------------|
| Device IP | ESP32's IP address | Input field in "Device Settings" |

## Network Diagram

```
┌─────────────────────────────────────────┐
│         Your WiFi Network               │
└─────────────────────────────────────────┘
           │                    │
           ▼                    ▼
    ┌─────────────┐      ┌──────────────┐
    │  Computer   │      │    ESP32     │
    │ 192.168.1.5 │◄────►│192.168.1.100 │
    │             │      │  DFPlayer    │
    │  Backend    │      │  Servo       │
    │  Frontend   │      │  WebServer   │
    └─────────────┘      └──────────────┘
         :5000                 :80
```

## Troubleshooting Configuration Issues

### "Device shows as Offline"

✓ Check: Is the ESP32 powered on?
✓ Check: Is it connected to the same WiFi as your computer?
✓ Check: Is the IP address correct in the web UI?
✓ Check: Can you ping it? (Command Prompt: `ping 192.168.1.100`)

### "Backend won't find the device"

✓ Make sure `backendIP` in Arduino code matches your computer's IP
✓ Make sure your computer and ESP32 are on the same WiFi network
✓ Make sure the backend is running

### "Arduino IDE uploads fail"

✓ Check COM port is correct
✓ Check baud rate is 115200
✓ Try other COM ports if available
✓ Disconnect and reconnect the USB cable

### "Can't access backend from browser"

✓ Make sure backend is running (`npm start`)
✓ Check http://localhost:5000/health works
✓ Verify firewall isn't blocking port 5000

## Advanced: Static IP for ESP32

For better reliability, you can assign a static IP to your ESP32:

**Option 1: Using Arduino Code**

Add this before `server.begin()` in `setup()`:

```cpp
// Set static IP
IPAddress local_IP(192, 168, 1, 100);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);
IPAddress secondaryDNS(8, 8, 4, 4);

WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS);
```

**Option 2: Using Router**

1. Log into router admin panel
2. Find DHCP settings
3. Add a DHCP reservation for the ESP32's MAC address
4. Assign it a static IP (e.g., 192.168.1.100)

## Final Checklist

Before you start using the system:

- [ ] Computer IP identified: `_________________`
- [ ] ESP32 IP identified: `_________________`
- [ ] Arduino code updated with WiFi credentials
- [ ] Arduino code updated with computer's IP
- [ ] Arduino code flashed to ESP32
- [ ] Backend running on port 5000
- [ ] Frontend accessible in browser
- [ ] Web UI shows "Connected" status
- [ ] Test soundworks
- [ ] Feeder dispenses food

## Getting Help

If configuration isn't working:

1. **Check Serial Monitor Output**
   - Look for error messages
   - Note the reported ESP32 IP

2. **Test Backend Connection**
   - Open browser: `http://localhost:5000/health`
   - Should show: `{"status":"Server running"}`

3. **Test ESP32 Connection**
   - Open browser: `http://192.168.1.100/api/status`
   - Should show device status JSON

4. **Check Firewall**
   - Windows: Check Settings → Privacy & Security → Firewall
   - Allow Node.js through firewall

---

**Once configured, the system will remember your settings! 🎉**

The web interface stores the device IP in your browser's local storage, so you won't need to reconfigure it each time.
