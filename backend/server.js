const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mqtt = require('mqtt');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MQTT_HOST = process.env.MQTT_HOST || '';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '8883', 10);
const MQTT_USER = process.env.MQTT_USER || '';
const MQTT_PASS = process.env.MQTT_PASS || '';

// Database
const db = require('./db');

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true; // true = allow all (safe for local dev)
app.use(cors({ 
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Device ID (unique identifier for this feeder)
const DEVICE_ID = process.env.DEVICE_ID || 'pawportion-001';
const MQTT_DEVICE_ID = process.env.MQTT_DEVICE_ID || DEVICE_ID;
const MQTT_ENABLED = Boolean(MQTT_HOST && MQTT_USER && MQTT_PASS);
const mqttCommandTopic = `pawportion/device/${MQTT_DEVICE_ID}/commands`;
const mqttStatusTopic = `pawportion/device/${MQTT_DEVICE_ID}/status`;
const mqttHeartbeatTopic = `pawportion/device/${MQTT_DEVICE_ID}/heartbeat`;
let mqttClient = null;

// Store ESP32 device state
const deviceState = {
  ip: process.env.ESP32_IP || '192.168.1.100',
  foodAmount: 0,
  selectedTone: 1,
  volumeLevel: 25,
  isFeeding: false,
  lastUpdate: new Date(),
  status: 'offline',
  mqttConnected: false
};

// ===========================
// Helper Functions
// ===========================

const updateStateFromPayload = async (payload = {}, source = 'mqtt') => {
  deviceState.foodAmount = payload.foodAmount ?? payload.food_amount ?? deviceState.foodAmount;
  deviceState.selectedTone = payload.selectedTone ?? payload.selected_tone ?? deviceState.selectedTone;
  deviceState.volumeLevel = payload.volumeLevel ?? payload.volume_level ?? deviceState.volumeLevel;
  deviceState.isFeeding = payload.isFeeding ?? payload.is_feeding ?? deviceState.isFeeding;

  if (payload.ip || payload.deviceIp) {
    deviceState.ip = payload.ip || payload.deviceIp;
  }

  if (typeof payload.online === 'boolean') {
    deviceState.status = payload.online ? 'online' : 'offline';
  }

  deviceState.lastUpdate = new Date();

  await db.logDeviceStatus(DEVICE_ID, {
    isOnline: deviceState.status === 'online',
    ipAddress: deviceState.ip,
    lastResponse: deviceState.lastUpdate,
    metadata: { source, payload }
  }).catch(err => console.error('DB Error:', err));
};

const connectMQTT = () => {
  if (!MQTT_ENABLED || mqttClient) {
    return;
  }

  mqttClient = mqtt.connect(`mqtts://${MQTT_HOST}:${MQTT_PORT}`, {
    username: MQTT_USER,
    password: MQTT_PASS,
    reconnectPeriod: 5000,
    connectTimeout: 15000
  });

  mqttClient.on('connect', () => {
    deviceState.mqttConnected = true;
    console.log(`✅ MQTT connected (${MQTT_HOST}:${MQTT_PORT})`);
    mqttClient.subscribe([mqttStatusTopic, mqttHeartbeatTopic], (err) => {
      if (err) {
        console.error('MQTT subscribe error:', err.message);
      }
    });
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT reconnecting...');
  });

  mqttClient.on('close', () => {
    deviceState.mqttConnected = false;
    console.log('⚠ MQTT disconnected');
  });

  mqttClient.on('error', (err) => {
    deviceState.mqttConnected = false;
    console.error('MQTT error:', err.message);
  });

  mqttClient.on('message', async (topic, messageBuffer) => {
    try {
      const payload = JSON.parse(messageBuffer.toString('utf8'));
      if (topic === mqttStatusTopic || topic === mqttHeartbeatTopic) {
        await updateStateFromPayload(payload, 'mqtt');
      }
    } catch (error) {
      console.error('MQTT message parse error:', error.message);
    }
  });
};

const publishMqttCommand = (commandPayload) => {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !deviceState.mqttConnected) {
      return reject(new Error('MQTT is not connected'));
    }

    mqttClient.publish(mqttCommandTopic, JSON.stringify(commandPayload), { qos: 1 }, (err) => {
      if (err) {
        return reject(err);
      }
      resolve({ ok: true, via: 'mqtt' });
    });
  });
};

const mapEndpointToCommand = (endpoint, data = {}) => {
  switch (endpoint) {
    case '/api/feed':
      return {
        type: 'feed',
        amount: data.amount ?? deviceState.foodAmount,
        tone: data.tone ?? deviceState.selectedTone,
        volume: data.volume ?? deviceState.volumeLevel
      };
    case '/api/food-amount':
      return { type: 'set_food_amount', amount: data.amount };
    case '/api/tone':
      return { type: 'set_tone', tone: data.tone };
    case '/api/volume':
      return { type: 'set_volume', volume: data.level };
    case '/api/play-sound':
      return { type: 'play_sound' };
    case '/api/status':
      return { type: 'status_request' };
    default:
      return null;
  }
};

// Send commands to ESP32 (MQTT preferred, HTTP fallback)
const sendToESP32 = async (endpoint, data = {}) => {
  if (MQTT_ENABLED && deviceState.mqttConnected) {
    const commandPayload = mapEndpointToCommand(endpoint, data);
    if (!commandPayload) {
      throw new Error(`Unsupported command endpoint for MQTT: ${endpoint}`);
    }

    const response = await publishMqttCommand(commandPayload);
    deviceState.status = 'online';
    deviceState.lastUpdate = new Date();
    return response;
  }

  try {
    const url = `http://${deviceState.ip}${endpoint}`;
    const response = await axios.post(url, data, { timeout: 5000 });
    deviceState.status = 'online';
    deviceState.lastUpdate = new Date();
    
    // Log status
    await db.logDeviceStatus(DEVICE_ID, {
      isOnline: true,
      ipAddress: deviceState.ip,
      lastResponse: new Date()
    }).catch(err => console.error('DB Error:', err));
    
    return response.data;
  } catch (error) {
    deviceState.status = 'offline';
    console.error('ESP32 Error:', error.message);
    
    // Log status
    await db.logDeviceStatus(DEVICE_ID, {
      isOnline: false,
      ipAddress: deviceState.ip
    }).catch(err => console.error('DB Error:', err));
    
    throw error;
  }
};

// Log activity
const logActivity = async (action, details = {}) => {
  try {
    await db.query(
      `INSERT INTO activity_logs (device_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [DEVICE_ID, action, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Activity log error:', err);
  }
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  const [salt, savedHash] = storedHash.split(':');
  const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(savedHash, 'hex'), Buffer.from(derivedHash, 'hex'));
};

const mapUserForClient = (user) => ({
  id: user.id,
  petName: user.pet_name,
  breed: user.breed,
  email: user.email,
  petImage: user.pet_image,
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

const syncESP32Status = async () => {
  if (MQTT_ENABLED && deviceState.mqttConnected) {
    sendToESP32('/api/status', {}).catch((err) => {
      console.error('MQTT status request failed:', err.message);
    });
    return deviceState;
  }

  try {
    const response = await axios.get(`http://${deviceState.ip}/api/status`, { timeout: 3000 });
    const payload = response.data || {};

    deviceState.foodAmount = payload.foodAmount ?? deviceState.foodAmount;
    deviceState.selectedTone = payload.selectedTone ?? deviceState.selectedTone;
    deviceState.volumeLevel = payload.volumeLevel ?? deviceState.volumeLevel;
    deviceState.isFeeding = Boolean(payload.isFeeding);
    deviceState.status = 'online';
    deviceState.lastUpdate = new Date();

    await db.logDeviceStatus(DEVICE_ID, {
      isOnline: true,
      ipAddress: deviceState.ip,
      lastResponse: deviceState.lastUpdate
    }).catch(err => console.error('DB Error:', err));
  } catch (error) {
    deviceState.status = 'offline';

    await db.logDeviceStatus(DEVICE_ID, {
      isOnline: false,
      ipAddress: deviceState.ip
    }).catch(err => console.error('DB Error:', err));
  }

  return deviceState;
};

// ===========================
// Initialization
// ===========================

app.listen(PORT, async () => {
  console.log(`🐾 Pawportion Backend running on port ${PORT}`);
  console.log(`📡 ESP32 IP: ${deviceState.ip}`);
  console.log(`🔧 Device ID: ${DEVICE_ID}`);
  if (MQTT_ENABLED) {
    console.log(`☁ MQTT broker: ${MQTT_HOST}:${MQTT_PORT}`);
  }
  
  // Initialize device in database
  try {
    const settings = await db.getOrCreateDevice(DEVICE_ID);
    deviceState.ip = settings.device_ip || deviceState.ip;
    deviceState.foodAmount = settings.food_amount ?? deviceState.foodAmount;
    deviceState.selectedTone = settings.selected_tone ?? deviceState.selectedTone;
    deviceState.volumeLevel = settings.volume_level ?? deviceState.volumeLevel;
    console.log('✅ Device settings loaded from database');
  } catch (error) {
    console.error('⚠️  Warning: Could not load device settings:', error.message);
  }

  connectMQTT();
});

// ===========================
// Status & Health Endpoints
// ===========================

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'Server running', device: DEVICE_ID });
});

/**
 * GET /api/status
 * Get current device status
 */
app.get('/api/status', (req, res) => {
  syncESP32Status()
    .then((status) => res.json(status))
    .catch(() => res.json(deviceState));
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key is not configured' });
    }

    const { message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const groqResponse = await axios.post(
      GROQ_URL,
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are PawDoc, a dog health and behavior assistant. Keep replies concise, practical, and safe. For urgent medical symptoms, advise seeing a licensed veterinarian.'
          },
          {
            role: 'user',
            content: String(message).trim()
          }
        ],
        temperature: 0.5,
        max_tokens: 400
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        timeout: 20000
      }
    );

    const reply = groqResponse?.data?.choices?.[0]?.message?.content || 'I could not generate a response right now.';
    res.json({ reply });
  } catch (error) {
    const details = error?.response?.data || error.message;
    console.error('AI chat error:', details);
    res.status(502).json({ error: 'AI service unavailable', details });
  }
});

// ===========================
// Auth Endpoints
// ===========================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { petName, breed, email, password, petImage } = req.body;

    if (!petName || !breed || !email || !password) {
      return res.status(400).json({ error: 'petName, breed, email, and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await db.getAppUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = hashPassword(password);
    const user = await db.createAppUser({
      petName: String(petName).trim(),
      breed: String(breed).trim(),
      email: normalizedEmail,
      passwordHash,
      petImage: petImage || 'https://placehold.co/72x72/orange/white?text=🐶'
    });

    res.status(201).json({ user: mapUserForClient(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await db.getAppUserByEmail(String(email).trim().toLowerCase());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ user: mapUserForClient(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/user/:id', async (req, res) => {
  try {
    const user = await db.getAppUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: mapUserForClient(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// Device Configuration Endpoints
// ===========================

/**
 * GET /api/device/settings
 * Get device settings from database
 */
app.get('/api/device/settings', async (req, res) => {
  try {
    const settings = await db.getDeviceSettings(DEVICE_ID);
    if (!settings) {
      const newSettings = await db.getOrCreateDevice(DEVICE_ID);
      return res.json(newSettings);
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/device/ip
 * Update ESP32 IP address
 */
app.post('/api/device/ip', async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'IP is required' });
    }

    deviceState.ip = ip;
    
    // Save to database
    await db.updateDeviceSettings(DEVICE_ID, { deviceIp: ip });
    await logActivity('device_ip_changed', { newIp: ip });
    
    res.json({ success: true, message: 'IP updated', ip });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// Feeding Endpoints
// ===========================

/**
 * POST /api/feed
 * Start feeding sequence
 */
app.post('/api/feed', async (req, res) => {
  try {
    if (deviceState.foodAmount <= 0) {
      return res.status(400).json({ error: 'Food amount not set' });
    }
    
    if (deviceState.isFeeding) {
      return res.status(400).json({ error: 'Already feeding' });
    }

    const userId = req.body.userId ? parseInt(req.body.userId, 10) : null;
    const startTime = Date.now();
    deviceState.isFeeding = true;

    // Send to ESP32
    await sendToESP32('/api/feed', { amount: deviceState.foodAmount });
    
    // Log to database
    await db.addFeedingLog({
      deviceId: DEVICE_ID,
      foodAmount: deviceState.foodAmount,
      selectedTone: deviceState.selectedTone,
      status: 'started',
      timestamp: new Date(),
      userId
    });
    
    await logActivity('feeding_started', {
      foodAmount: deviceState.foodAmount,
      selectedTone: deviceState.selectedTone
    });
    
    res.json({ success: true, message: 'Feeding started' });
    
    // Simulate feeding completion
    const estimatedDuration = deviceState.foodAmount * 500 + 2000 + 1000;
    setTimeout(() => {
      deviceState.isFeeding = false;
      
      // Log completion
      const duration = Date.now() - startTime;
      db.addFeedingLog({
        deviceId: DEVICE_ID,
        foodAmount: deviceState.foodAmount,
        selectedTone: deviceState.selectedTone,
        status: 'completed',
        duration: duration,
        timestamp: new Date(),
        userId
      }).catch(err => console.error('DB Error:', err));
      
      logActivity('feeding_completed', { duration });
    }, estimatedDuration);
    
  } catch (error) {
    deviceState.isFeeding = false;
    
    // Log error
    await db.addFeedingLog({
      deviceId: DEVICE_ID,
      foodAmount: deviceState.foodAmount,
      selectedTone: deviceState.selectedTone,
      status: 'failed',
      error_message: error.message,
      timestamp: new Date()
    }).catch(err => console.error('DB Error:', err));
    
    res.status(500).json({ error: 'Failed to start feeding', details: error.message });
  }
});

/**
 * POST /api/food-amount
 * Set food amount
 */
app.post('/api/food-amount', async (req, res) => {
  try {
    const { amount } = req.body;
    if (amount === undefined || amount < 0 || amount > 20) {
      return res.status(400).json({ error: 'Invalid amount (0-20)' });
    }

    // Update local state first so /api/status always reflects commanded value
    deviceState.foodAmount = amount;

    // Save to database
    await db.updateDeviceSettings(DEVICE_ID, { foodAmount: amount });
    await logActivity('food_amount_changed', { newAmount: amount });

    // Forward to ESP32 in background – never block the HTTP response
    sendToESP32('/api/food-amount', { amount }).catch(err =>
      console.error('ESP32 food-amount forward failed:', err.message)
    );

    res.json({ success: true, foodAmount: amount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// Sound/Tone Endpoints
// ===========================

/**
 * GET /api/feeding/logs
 * Get feeding history
 */
app.get('/api/feeding/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    const logs = await db.getFeedingLogs(DEVICE_ID, limit, userId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feeding/stats
 * Get feeding statistics
 */
app.get('/api/feeding/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await db.getFeedingStats(DEVICE_ID, days);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feeding/stats/daily
 * Get daily feeding statistics
 */
app.get('/api/feeding/stats/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    const params = [DEVICE_ID, days];
    let userFilter = '';
    if (userId !== null) {
      params.push(userId);
      userFilter = ` AND user_id = $${params.length}`;
    }
    const result = await db.query(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(*) as feeding_count,
        SUM(food_amount) as total_food,
        AVG(food_amount) as avg_food
       FROM feeding_logs 
       WHERE device_id = $1 AND status = 'completed'
         AND timestamp > NOW() - ($2 * INTERVAL '1 day')${userFilter}
       GROUP BY DATE(timestamp)
       ORDER BY date DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tone
 * Select tone
 */
app.post('/api/tone', async (req, res) => {
  try {
    const { tone } = req.body;
    if (tone === undefined || tone < 1 || tone > 10) {
      return res.status(400).json({ error: 'Tone must be between 1 and 10' });
    }

    // Update local state first
    deviceState.selectedTone = tone;

    // Forward to ESP32 in background
    sendToESP32('/api/tone', { tone }).catch(err =>
      console.error('ESP32 tone forward failed:', err.message)
    );
    
    // Save to database
    await db.updateDeviceSettings(DEVICE_ID, { selectedTone: tone });
    await logActivity('tone_selected', { selectedTone: tone });
    
    res.json({ success: true, selectedTone: tone });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/volume
 * Set volume level
 */
app.post('/api/volume', async (req, res) => {
  try {
    const { level } = req.body;
    if (level === undefined || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Volume must be between 0 and 100' });
    }

    deviceState.volumeLevel = level;
    
    // Send to ESP32
    await sendToESP32('/api/volume', { level });
    
    // Save to database
    await db.updateDeviceSettings(DEVICE_ID, { volumeLevel: level });
    await logActivity('volume_changed', { volumeLevel: level });
    
    res.json({ success: true, volumeLevel: level });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/play-sound
 * Play test sound
 */
app.post('/api/play-sound', async (req, res) => {
  try {
    await sendToESP32('/api/play-sound', {});
    
    await logActivity('test_sound_played', { selectedTone: deviceState.selectedTone });
    
    res.json({ success: true, message: 'Sound playing' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to play sound' });
  }
});

// ===========================
// Feeding Schedule Endpoints
// ===========================

/**
 * GET /api/schedules
 * Get all feeding schedules
 */
app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await db.getFeedingSchedules(DEVICE_ID);
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schedules
 * Create new feeding schedule
 */
app.post('/api/schedules', async (req, res) => {
  try {
    const { scheduledTime, foodAmount, days } = req.body;
    
    if (!scheduledTime || !foodAmount || !days) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const schedule = await db.addFeedingSchedule(DEVICE_ID, {
      scheduledTime,
      foodAmount,
      days
    });
    
    await logActivity('schedule_created', { scheduledTime, foodAmount, days });
    
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schedules/:id
 * Update feeding schedule
 */
app.put('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledTime, foodAmount, days, enabled } = req.body;
    
    const schedule = await db.updateFeedingSchedule(id, {
      scheduledTime,
      foodAmount,
      days,
      enabled
    });
    
    await logActivity('schedule_updated', { scheduleId: id, enabled });
    
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete feeding schedule
 */
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.deleteFeedingSchedule(id);
    await logActivity('schedule_deleted', { scheduleId: id });
    
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// Status History Endpoints
// ===========================

/**
 * GET /api/status/history
 * Get device status history
 */
app.get('/api/status/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await db.getDeviceStatusHistory(DEVICE_ID, limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// Activity Log Endpoints
// ===========================

/**
 * GET /api/activity/logs
 * Get activity log
 */
app.get('/api/activity/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await db.query(
      `SELECT * FROM activity_logs 
       WHERE device_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [DEVICE_ID, limit]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// Dashboard/Summary Endpoints
// ===========================

/**
 * GET /api/dashboard
 * Get comprehensive dashboard data
 */
app.get('/api/dashboard', async (req, res) => {
  try {
    const settings = await db.getDeviceSettings(DEVICE_ID);
    const todayStats = await db.query(
      `SELECT COUNT(*) as count, SUM(food_amount) as total 
       FROM feeding_logs 
       WHERE device_id = $1 AND DATE(timestamp) = CURRENT_DATE AND status = 'completed'`,
      [DEVICE_ID]
    );
    const weekStats = await db.getFeedingStats(DEVICE_ID, 7);
    const recentLogs = await db.getFeedingLogs(DEVICE_ID, 10);
    
    res.json({
      settings,
      today: todayStats.rows[0],
      thisWeek: weekStats,
      recentFeedings: recentLogs,
      deviceState
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// Error Handling
// ===========================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large', message: 'Image is too large. Please upload a smaller image (max ~7MB).' });
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
