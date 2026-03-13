const { Pool } = require('pg');
require('dotenv').config();

// Create pool (connection pool for better performance)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    };

const pool = new Pool(poolConfig);

// Connection test
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// ===========================
// Database Query Helpers
// ===========================

/**
 * Execute a query
 */
const query = (text, params) => {
  return pool.query(text, params);
};

/**
 * Get device settings
 */
const getDeviceSettings = async (deviceId) => {
  const result = await query(
    'SELECT * FROM device_settings WHERE device_id = $1',
    [deviceId]
  );
  return result.rows[0] || null;
};

/**
 * Update device settings
 */
const updateDeviceSettings = async (deviceId, settings) => {
  const currentSettings = await getOrCreateDevice(deviceId);
  const { foodAmount, selectedTone, volumeLevel, deviceIp } = settings;
  const result = await query(
    `UPDATE device_settings 
     SET food_amount = $1, selected_tone = $2, volume_level = $3, device_ip = $4, updated_at = NOW()
     WHERE device_id = $5
     RETURNING *`,
    [
      foodAmount ?? currentSettings.food_amount,
      selectedTone ?? currentSettings.selected_tone,
      volumeLevel ?? currentSettings.volume_level,
      deviceIp ?? currentSettings.device_ip,
      deviceId
    ]
  );
  return result.rows[0];
};

/**
 * Get or create device settings
 */
const getOrCreateDevice = async (deviceId) => {
  let settings = await getDeviceSettings(deviceId);
  
  if (!settings) {
    const result = await query(
      `INSERT INTO device_settings (device_id, food_amount, selected_tone, volume_level)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [deviceId, 5, 1, 25]
    );
    settings = result.rows[0];
  }
  
  return settings;
};

/**
 * Add feeding log
 */
const addFeedingLog = async (feedingLog) => {
  const { deviceId, foodAmount, selectedTone, status, duration, timestamp, userId } = feedingLog;
  const result = await query(
    `INSERT INTO feeding_logs (device_id, food_amount, selected_tone, status, duration, timestamp, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [deviceId, foodAmount, selectedTone, status, duration, timestamp || new Date(), userId || null]
  );
  return result.rows[0];
};

/**
 * Get feeding logs
 */
const getFeedingLogs = async (deviceId, limit = 50, userId = null) => {
  let sql = 'SELECT * FROM feeding_logs WHERE device_id = $1';
  const params = [deviceId];
  if (userId !== null) {
    params.push(userId);
    sql += ` AND user_id = $${params.length}`;
  }
  sql += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Get feeding statistics
 */
const getFeedingStats = async (deviceId, days = 7, userId = null) => {
  let sql = `SELECT 
       COUNT(*) as total_feedings,
       SUM(food_amount) as total_food_dispensed,
       AVG(food_amount) as avg_food_per_feeding,
       AVG(duration) as avg_duration
     FROM feeding_logs 
     WHERE device_id = $1 AND timestamp > NOW() - ($2 * INTERVAL '1 day')`;
  const params = [deviceId, days];
  if (userId !== null) {
    params.push(userId);
    sql += ` AND user_id = $${params.length}`;
  }
  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Add device status log
 */
const logDeviceStatus = async (deviceId, status) => {
  const { isOnline, ipAddress, lastResponse } = status;
  const result = await query(
    `INSERT INTO device_status_logs (device_id, is_online, ip_address, last_response)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [deviceId, isOnline, ipAddress, lastResponse || new Date()]
  );
  return result.rows[0];
};

/**
 * Get device status history
 */
const getDeviceStatusHistory = async (deviceId, limit = 50) => {
  const result = await query(
    `SELECT * FROM device_status_logs 
     WHERE device_id = $1 
     ORDER BY timestamp DESC 
     LIMIT $2`,
    [deviceId, limit]
  );
  return result.rows;
};

/**
 * Get feeding schedule
 */
const getFeedingSchedules = async (deviceId) => {
  const result = await query(
    'SELECT * FROM feeding_schedules WHERE device_id = $1 ORDER BY scheduled_time ASC',
    [deviceId]
  );
  return result.rows;
};

/**
 * Add feeding schedule
 */
const addFeedingSchedule = async (deviceId, schedule) => {
  const { scheduledTime, foodAmount, days } = schedule;
  const result = await query(
    `INSERT INTO feeding_schedules (device_id, scheduled_time, food_amount, days, enabled)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [deviceId, scheduledTime, foodAmount, days]
  );
  return result.rows[0];
};

/**
 * Update feeding schedule
 */
const updateFeedingSchedule = async (scheduleId, schedule) => {
  const { scheduledTime, foodAmount, days, enabled } = schedule;
  const result = await query(
    `UPDATE feeding_schedules 
     SET scheduled_time = $1, food_amount = $2, days = $3, enabled = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [scheduledTime, foodAmount, days, enabled, scheduleId]
  );
  return result.rows[0];
};

/**
 * Delete feeding schedule
 */
const deleteFeedingSchedule = async (scheduleId) => {
  await query('DELETE FROM feeding_schedules WHERE id = $1', [scheduleId]);
};

/**
 * Get app user by email
 */
const getAppUserByEmail = async (email) => {
  const result = await query(
    'SELECT * FROM app_users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
};

/**
 * Get app user by id
 */
const getAppUserById = async (id) => {
  const result = await query(
    'SELECT id, pet_name, breed, email, pet_image, created_at, updated_at FROM app_users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Create app user
 */
const createAppUser = async ({ petName, breed, email, passwordHash, petImage }) => {
  const result = await query(
    `INSERT INTO app_users (pet_name, breed, email, password_hash, pet_image)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, pet_name, breed, email, pet_image, created_at, updated_at`,
    [petName, breed, email, passwordHash, petImage]
  );
  return result.rows[0];
};

// Export all functions
module.exports = {
  pool,
  query,
  getDeviceSettings,
  updateDeviceSettings,
  getOrCreateDevice,
  addFeedingLog,
  getFeedingLogs,
  getFeedingStats,
  logDeviceStatus,
  getDeviceStatusHistory,
  getFeedingSchedules,
  addFeedingSchedule,
  updateFeedingSchedule,
  deleteFeedingSchedule,
  getAppUserByEmail,
  getAppUserById,
  createAppUser
};
