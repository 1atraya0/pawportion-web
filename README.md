# 🐾 Pawportion - Smart Pet Feeder Web Interface

A modern, beautiful web-based control system for your ESP32-based automatic pet feeder, replacing the Blynk app with a custom-built web application.

## 📋 Project Structure

```
pawportion-web/
├── frontend/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # Modern CSS styling
│   └── script.js           # Client-side JavaScript
├── backend/
│   ├── server.js           # Express.js backend server
│   ├── package.json        # Node.js dependencies
│   └── .env                # Configuration file
└── pawportion_feeder.ino   # Updated Arduino code for ESP32
```

## ✨ Features

### Frontend
- **Modern Design**: Beautiful gradient backgrounds and smooth animations
- **Responsive**: Works seamlessly on desktop, tablet, and mobile devices
- **Real-time Status**: Live device connection status and feeding information
- **Easy Controls**:
  - Food amount slider (1-20 portions)
  - Volume control (0-100%)
  - 10 different sound tones
  - One-click feeding button
  - Test sound playback
  - Device IP configuration

### Backend
- **Express.js Server**: Lightweight and efficient
- **REST API**: Clear endpoint structure
- **Device Management**: Easy ESP32 IP configuration
- **Error Handling**: Comprehensive error responses
- **CORS Support**: Works across different domains

### Arduino/ESP32
- **WebServer**: Embedded HTTP server instead of Blynk
- **JSON Support**: Modern API communication
- **State Management**: Proper feeder state machine
- **Servo Control**: Smooth gate operation
- **Sound Playback**: DFPlayer Mini integration

## 🚀 Quick Start

### Prerequisites
- Node.js and npm installed
- ESP32 with Arduino IDE configured
- WiFi network available
- DFPlayer Mini module
- Servo motor
- USB cable for ESP32 programming

### 1. Backend Setup

```bash
cd backend
npm install
```

Configure `.env` file:
```
PORT=5000
ESP32_IP=192.168.1.100  # Update with your ESP32's IP
```

Start the server:
```bash
npm start
```

Or with auto-reload (requires nodemon):
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### 2. Frontend Setup

1. Open `frontend/index.html` in a web browser
2. Or serve it with a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js http-server
npx http-server frontend
```

Then open `http://localhost:8000` (or appropriate port)

### 3. Arduino/ESP32 Setup

1. **Install Required Libraries** in Arduino IDE:
   - Go to Sketch → Include Library → Manage Libraries
   - Search and install:
     - `ESP32Servo`
     - `DFRobotDFPlayerMini`
     - `ArduinoJson`

2. **Update Configuration** in `pawportion_feeder.ino`:
   ```cpp
   const char* ssid = "your_wifi_name";
   const char* password = "your_wifi_password";
   const char* backendIP = "192.168.1.X"; // Your computer's IP
   ```

3. **Flash the Code**:
   - Select your ESP32 board (Tools → Board)
   - Select correct COM port (Tools → Port)
   - Click Upload

4. **Find Your ESP32's IP**:
   - Check your router's connected devices list
   - Or open Arduino Serial Monitor to see the IP printed

5. **Configure the Web Interface**:
   - In the web UI, go to "Device Settings"
   - Enter your ESP32's IP address
   - Click "Update"

## 🎮 Usage Guide

### Food Amount
- Use the slider to select portions (1-20)
- Click "Set Amount" to confirm
- This value is used when you press the feed button

### Volume Control
- Range: 0-100%
- Affects the tone playback volume
- Click "Set Volume" to apply changes

### Sound Tones
- 10 different tones available (numbered 1-10)
- Click any tone number to select it
- Press "Test Sound" to preview the selected tone
- Keyboard shortcut: Press number keys 1-9 to select tones

### Feeding
- Ensure food amount is set
- Click the large "START FEEDING" button
- The feeder will:
  1. Open the gate for (foodAmount × 500ms)
  2. Close the gate for 2 seconds
  3. Play a tone notification
  4. Return to idle state
- Keyboard shortcut: Press spacebar to start feeding

### Device Settings
- Update your ESP32's IP address anytime
- The system remembers your IP in browser storage
- Connection status displayed in top right

## 📊 System Status

The status panel shows:
- **Food Amount**: Currently set portion size
- **Volume**: Current volume level
- **Selected Tone**: Active sound tone
- **Feeding Status**: Current operation state
- **Connection**: Real-time device connection status

## 🔌 Hardware Configuration

### Pin Connections (ESP32)
- **GPIO 13**: Servo motor (PWM)
- **GPIO 16**: DFPlayer Mini RX
- **GPIO 17**: DFPlayer Mini TX
- **5V**: Power for servo and DFPlayer
- **GND**: Ground connection

### Servo Positioning
- **0°**: Closed (food blocked)
- **90°**: Open (food dispensing)

## 🌐 API Endpoints

### GET /api/status
Returns current device state
```json
{
  "ip": "192.168.1.100",
  "foodAmount": 5,
  "selectedTone": 1,
  "volumeLevel": 25,
  "isFeeding": false,
  "status": "online"
}
```

### POST /api/feed
Start feeding sequence
```json
{ "amount": 5 }
```

### POST /api/food-amount
Set food portion amount
```json
{ "amount": 5 }
```

### POST /api/tone
Select sound tone
```json
{ "tone": 3 }
```

### POST /api/volume
Set volume level
```json
{ "level": 50 }
```

### POST /api/play-sound
Play test sound (no parameters)

### POST /api/device/ip
Update ESP32 IP address
```json
{ "ip": "192.168.1.100" }
```

## 🎨 Customization

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary-color: #FF6B6B;      /* Main red */
    --secondary-color: #4ECDC4;    /* Teal */
    --accent-color: #FFE66D;        /* Yellow */
    --dark-bg: #1a1a2e;            /* Dark background */
}
```

### Background Images
The gradient background is created with CSS. To use custom images:
1. Place image files in the frontend folder
2. Modify the `.background` CSS class in `styles.css`
3. Update the `background-image` property with your image path

### Add Custom Tones
To add more than 10 tones:
1. Update `.tone-grid` in HTML (grid-template-columns)
2. Modify `MAX_TONES` in Arduino code
3. Update validation in backend and frontend

## 🔧 Troubleshooting

### Backend Won't Start
```bash
# Check if port 5000 is in use
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Mac/Linux

# Kill the process and try again
npm start
```

### Frontend Can't Connect to Backend
- Ensure backend is running on `localhost:5000`
- Check CORS is enabled (it is by default)
- Verify API_BASE_URL in `script.js`

### ESP32 Won't Connect to WiFi
- Double-check WiFi credentials (case-sensitive)
- Ensure WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Check router is in range

### Device Shows as Offline
- Verify ESP32 is powered and connected
- Check the device IP in web UI matches ESP32's actual IP
- Look at Arduino Serial Monitor for debug info
- Ensure backend server is running

### DFPlayer Mini Not Detected
- Check wiring (RX/TX connections)
- Verify SD card is properly inserted
- Check serial baud rate is 9600
- Try pressing reset button on DFPlayer Mini

### Servo Not Moving
- Check GPIO 13 connection
- Verify servo power supply (5V)
- Test servo with simple Arduino sketch
- Check servo library is installed

## 📱 Browser Compatibility

- **Chrome/Chromium**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Good support
- **Edge**: ✅ Full support
- **Mobile Browsers**: ✅ Responsive design

## 🔐 Security Notes

⚠️ **Important for Production:**
- This system is designed for local network use
- Don't expose backend to the internet without authentication
- Implement password protection for production deployments
- Use HTTPS if accessing from outside your network

## 📝 License

This project is provided as-is for personal use.

## 🐶 Tips for Success

1. **Test Everything**: Verify each component before final assembly
2. **Label Wires**: Makes troubleshooting much easier
3. **Start Simple**: Get basic functionality working first
4. **Monitor Logs**: Check Arduino Serial Monitor while testing
5. **Backup Settings**: Save your configuration IP address
6. **Update Firmware**: Keep your ESP32 libraries updated

## 🆘 Getting Help

1. Check Arduino Serial Monitor for debug messages
2. Verify all connections are secure
3. Test components individually
4. Check the troubleshooting section above
5. Review browser console for JavaScript errors (F12)

---

**Happy Feeding! 🐾**

Your pets will love the automatic feeder. Enjoy watching them get excited when the food dispenser opens!
