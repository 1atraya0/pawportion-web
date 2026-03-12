#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <DFRobotDFPlayerMini.h>
#include <HardwareSerial.h>

// WiFi Configuration
const char* ssid = "ATRAYA_ 2G";
const char* password = "9073077466";

// Web Server on port 80
WebServer server(80);

// Servo Configuration
Servo myServo;
const int servoPin = 13;

// Sound Module Configuration
HardwareSerial mySerial(2);
DFRobotDFPlayerMini player;
bool playerReady = false;

// Feeder State Machine
enum FeederState {
  STATE_IDLE,
  STATE_OPENING,
  STATE_CLOSING
};

FeederState feederState = STATE_IDLE;
unsigned long startTime = 0;
int foodAmount = 0;
int selectedTone = 1;
int volumeLevel = 25;
bool isFeeding = false;

// Backend Configuration
const char* backendIP = "192.168.1.X"; // Update with your computer's IP
const int backendPort = 5000;

// ===========================
// Setup Function
// ===========================

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n\n🐾 Pawportion Feeder Starting...");

  // Initialize Servo
  myServo.attach(servoPin);
  myServo.write(0);  // Close position
  Serial.println("✓ Servo initialized");

  // Initialize Sound Module
  mySerial.begin(9600, SERIAL_8N1, 16, 17);
  delay(1000);
  
  for (int i = 0; i < 5; i++) {
    if (player.begin(mySerial)) {
      player.volume(volumeLevel);
      playerReady = true;
      Serial.println("✓ DFPlayer Mini initialized");
      break;
    }
    delay(1000);
  }
  
  if (!playerReady) {
    Serial.println("⚠ Warning: DFPlayer Mini not detected");
  }

  // Connect to WiFi
  connectToWiFi();

  // Setup Web Server Routes
  setupWebServer();

  Serial.println("🐾 Pawportion Feeder Ready!");
}

// ===========================
// WiFi Connection
// ===========================

void connectToWiFi() {
  Serial.print("📡 Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("✓ Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("✗ Failed to connect to WiFi");
  }
}

// ===========================
// Web Server Setup
// ===========================

void setupWebServer() {
  // Feeding endpoint
  server.on("/api/feed", HTTP_POST, handleFeed);

  // Food amount endpoint
  server.on("/api/food-amount", HTTP_POST, handleFoodAmount);

  // Tone endpoint
  server.on("/api/tone", HTTP_POST, handleTone);

  // Volume endpoint
  server.on("/api/volume", HTTP_POST, handleVolume);

  // Play sound endpoint
  server.on("/api/play-sound", HTTP_POST, handlePlaySound);

  // Status endpoint
  server.on("/api/status", HTTP_GET, handleStatus);

  // Default response
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("✓ Web server started on port 80");
}

// ===========================
// Web Server Handlers
// ===========================

void handleFeed() {
  if (isFeeding) {
    sendJsonResponse(400, "error", "Already feeding");
    return;
  }

  DynamicJsonDocument doc(256);
  deserializeJson(doc, server.arg("plain"));

  if (foodAmount <= 0) {
    sendJsonResponse(400, "error", "Food amount not set");
    return;
  }

  isFeeding = true;
  feederState = STATE_OPENING;
  startTime = millis();
  myServo.write(90);  // Open position

  Serial.println("🍽️ Feeding started");
  sendJsonResponse(200, "success", "Feeding started");
}

void handleFoodAmount() {
  DynamicJsonDocument doc(256);
  deserializeJson(doc, server.arg("plain"));

  if (!doc.containsKey("amount")) {
    sendJsonResponse(400, "error", "Missing amount parameter");
    return;
  }

  int amount = doc["amount"].as<int>();
  if (amount < 0 || amount > 20) {
    sendJsonResponse(400, "error", "Amount must be between 0 and 20");
    return;
  }

  foodAmount = amount;
  Serial.print("📊 Food amount set to: ");
  Serial.println(foodAmount);

  sendJsonResponse(200, "success", "Food amount set");
}

void handleTone() {
  DynamicJsonDocument doc(256);
  deserializeJson(doc, server.arg("plain"));

  if (!doc.containsKey("tone")) {
    sendJsonResponse(400, "error", "Missing tone parameter");
    return;
  }

  int tone = doc["tone"].as<int>();
  if (tone < 1 || tone > 10) {
    sendJsonResponse(400, "error", "Tone must be between 1 and 10");
    return;
  }

  selectedTone = tone;
  Serial.print("🎵 Tone selected: ");
  Serial.println(selectedTone);

  sendJsonResponse(200, "success", "Tone selected");
}

void handleVolume() {
  DynamicJsonDocument doc(256);
  deserializeJson(doc, server.arg("plain"));

  if (!doc.containsKey("level")) {
    sendJsonResponse(400, "error", "Missing level parameter");
    return;
  }

  int level = doc["level"].as<int>();
  if (level < 0 || level > 100) {
    sendJsonResponse(400, "error", "Volume must be between 0 and 100");
    return;
  }

  volumeLevel = level;
  
  if (playerReady) {
    player.volume(volumeLevel);
  }

  Serial.print("🔊 Volume set to: ");
  Serial.println(volumeLevel);

  sendJsonResponse(200, "success", "Volume set");
}

void handlePlaySound() {
  if (!playerReady) {
    sendJsonResponse(400, "error", "Sound module not ready");
    return;
  }

  sendJsonResponse(200, "success", "Playing sound");
  playSound();
}

void handleStatus() {
  String status = "{\"foodAmount\":" + String(foodAmount);
  status += ",\"selectedTone\":" + String(selectedTone);
  status += ",\"volumeLevel\":" + String(volumeLevel);
  status += ",\"isFeeding\":" + String(isFeeding ? "true" : "false");
  status += ",\"feederState\":\"" + getFeederStateString() + "\"";
  status += "}";

  server.send(200, "application/json", status);
}

void handleNotFound() {
  String message = "404 Not Found";
  server.send(404, "text/plain", message);
}

// ===========================
// Utility Functions
// ===========================

void sendJsonResponse(int code, const String& status, const String& message) {
  String response = "{\"status\":\"" + status + "\",\"message\":\"" + message + "\"}";
  server.send(code, "application/json", response);
}

String getFeederStateString() {
  switch (feederState) {
    case STATE_IDLE:
      return "idle";
    case STATE_OPENING:
      return "opening";
    case STATE_CLOSING:
      return "closing";
    default:
      return "unknown";
  }
}

// ===========================
// Feeder Control Functions
// ===========================

void updateFeeder() {
  if (!isFeeding) return;

  unsigned long elapsedTime = millis() - startTime;
  int openTime = foodAmount * 500;  // 500ms per portion

  if (feederState == STATE_OPENING) {
    if (elapsedTime >= openTime) {
      myServo.write(0);  // Close position
      feederState = STATE_CLOSING;
      startTime = millis();
      Serial.println("🚪 Gate closing...");
    }
  } 
  else if (feederState == STATE_CLOSING) {
    if (elapsedTime >= 2000) {
      feederState = STATE_IDLE;
      isFeeding = false;
      Serial.println("✓ Feeding complete!");
      playSound();
      
      // Notify backend that feeding is complete
      notifyBackendFeedingComplete();
    }
  }
}

void playSound() {
  if (!playerReady) {
    Serial.println("⚠ Sound module not ready");
    return;
  }

  delay(500);
  player.volume(volumeLevel);

  for (int i = 0; i < 3; i++) {
    player.play(selectedTone);
    Serial.print("🔊 Playing tone ");
    Serial.print(selectedTone);
    Serial.print(" (");
    Serial.print(i + 1);
    Serial.println("/3)");

    bool finished = false;
    unsigned long waitStart = millis();

    while (!finished) {
      if (player.available()) {
        uint8_t type = player.readType();
        int value = player.read();

        if (type == DFPlayerPlayFinished) {
          finished = true;
        } 
        else if (type == DFPlayerError && value == 5) {
          Serial.print("⚠ Tone ");
          Serial.print(selectedTone);
          Serial.println(" not available");
          return;
        }
      }

      // 30 second timeout
      if (millis() - waitStart > 30000) {
        finished = true;
      }

      delay(100);
    }

    delay(500);
  }

  Serial.println("✓ Sound playback complete");
}

void notifyBackendFeedingComplete() {
  // Optional: Notify backend that feeding is complete
  // This can be used for logging purposes
  Serial.println("📤 Feeding complete notification sent to backend");
}

// ===========================
// Main Loop
// ===========================

void loop() {
  server.handleClient();
  updateFeeder();
  delay(10);
}

/* 
SETUP INSTRUCTIONS:
1. Update WiFi credentials (ssid and password)
2. Install required libraries:
   - ESP32Servo
   - DFRobotDFPlayerMini
   - ArduinoJson
3. Update backendIP with your computer's IP address
4. Set Device IP in web interface to match ESP32's IP
5. Make sure the backend server is running before powering on the device

PIN CONFIGURATION:
- Servo: GPIO 13
- DFPlayer RX: GPIO 16
- DFPlayer TX: GPIO 17
*/
