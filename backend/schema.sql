-- Pawportion Database Schema
-- PostgreSQL/Supabase

-- ===========================
-- Device Settings Table
-- ===========================
CREATE TABLE IF NOT EXISTS device_settings (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    food_amount INT DEFAULT 5,
    selected_tone INT DEFAULT 1,
    volume_level INT DEFAULT 25,
    device_ip VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================
-- Feeding Logs Table
-- ===========================
CREATE TABLE IF NOT EXISTS feeding_logs (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    food_amount INT NOT NULL,
    selected_tone INT,
    status VARCHAR(20) DEFAULT 'completed', -- 'started', 'completed', 'failed'
    duration INT, -- in milliseconds
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES device_settings(device_id) ON DELETE CASCADE
);

-- Add user_id column if not present (safe to run on existing databases)
ALTER TABLE feeding_logs ADD COLUMN IF NOT EXISTS user_id INT REFERENCES app_users(id) ON DELETE SET NULL;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_feeding_logs_device_id ON feeding_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_timestamp ON feeding_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_user_id ON feeding_logs(user_id);

-- ===========================
-- Device Status Logs Table
-- ===========================
CREATE TABLE IF NOT EXISTS device_status_logs (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    is_online BOOLEAN DEFAULT true,
    ip_address VARCHAR(20),
    last_response TIMESTAMP,
    timestamp TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES device_settings(device_id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_device_status_device_id ON device_status_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_device_status_timestamp ON device_status_logs(timestamp);

-- ===========================
-- Feeding Schedules Table
-- ===========================
CREATE TABLE IF NOT EXISTS feeding_schedules (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    scheduled_time TIME NOT NULL, -- HH:MM format
    food_amount INT NOT NULL,
    days VARCHAR(100), -- "1,2,3,4,5,6,7" for days of week (1=Monday, 7=Sunday)
    enabled BOOLEAN DEFAULT true,
    last_executed TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES device_settings(device_id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_feeding_schedules_device_id ON feeding_schedules(device_id);

-- ===========================
-- User Preferences Table
-- ===========================
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    ui_theme VARCHAR(20) DEFAULT 'light', -- 'light', 'dark'
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    email VARCHAR(255),
    phone_number VARCHAR(20),
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES device_settings(device_id) ON DELETE CASCADE
);

-- ===========================
-- App Users Table
-- ===========================
CREATE TABLE IF NOT EXISTS app_users (
    id SERIAL PRIMARY KEY,
    pet_name VARCHAR(100) NOT NULL,
    breed VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pet_image TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- ===========================
-- Activity Log Table (for audit trail)
-- ===========================
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL, -- 'feed', 'settings_changed', 'schedule_created', etc.
    details JSONB, -- Store additional data as JSON
    ip_address VARCHAR(20),
    timestamp TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES device_settings(device_id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_device_id ON activity_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);

-- ===========================
-- API Tokens Table (for future API access)
-- ===========================
CREATE TABLE IF NOT EXISTS api_tokens (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES device_settings(device_id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_device_id ON api_tokens(device_id);

-- ===========================
-- Alerts/Notifications Table
-- ===========================
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    alert_type VARCHAR(50), -- 'low_food', 'device_offline', 'malfunction', etc.
    title VARCHAR(255),
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (device_id) REFERENCES device_settings(device_id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

-- ===========================
-- View: Daily Feeding Statistics
-- ===========================
CREATE OR REPLACE VIEW daily_feeding_stats AS
SELECT 
    device_id,
    DATE(timestamp) as feeding_date,
    COUNT(*) as feeding_count,
    SUM(food_amount) as total_food_dispensed,
    AVG(food_amount) as avg_food_per_feeding,
    MIN(timestamp) as first_feeding,
    MAX(timestamp) as last_feeding
FROM feeding_logs
WHERE status = 'completed'
GROUP BY device_id, DATE(timestamp)
ORDER BY feeding_date DESC;

-- ===========================
-- View: Device Summary
-- ===========================
CREATE OR REPLACE VIEW device_summary AS
SELECT 
    ds.id,
    ds.device_id,
    ds.food_amount,
    ds.selected_tone,
    ds.volume_level,
    ds.device_ip,
    ds.is_active,
    COUNT(DISTINCT DATE(fl.timestamp)) as feeding_days_count,
    COALESCE(SUM(fl.food_amount), 0) as total_food_dispensed,
    COUNT(fl.id) as total_feedings,
    MAX(fl.timestamp) as last_feeding_time,
    MAX(dsl.timestamp) as last_status_check,
    BOOL_OR(dsl.is_online) as is_online
FROM device_settings ds
LEFT JOIN feeding_logs fl ON ds.device_id = fl.device_id AND fl.status = 'completed'
LEFT JOIN device_status_logs dsl ON ds.device_id = dsl.device_id
WHERE ds.is_active = true
GROUP BY 
    ds.id, ds.device_id, ds.food_amount, ds.selected_tone, 
    ds.volume_level, ds.device_ip, ds.is_active;

-- ===========================
-- Comments for documentation
-- ===========================
COMMENT ON TABLE device_settings IS 'Stores the current settings for each pet feeder device';
COMMENT ON TABLE feeding_logs IS 'Records every feeding event with details';
COMMENT ON TABLE device_status_logs IS 'Tracks device online/offline status over time';
COMMENT ON TABLE feeding_schedules IS 'Stores automated feeding schedules';
COMMENT ON TABLE user_preferences IS 'User preferences and notification settings';
COMMENT ON TABLE app_users IS 'Registered app users with pet profile information';
COMMENT ON TABLE activity_logs IS 'Audit trail of all actions performed';
COMMENT ON TABLE api_tokens IS 'API tokens for programmatic access';
COMMENT ON TABLE alerts IS 'System alerts and notifications';

-- ===========================
-- Sample Data (for testing)
-- ===========================
-- Uncomment to insert sample device
-- INSERT INTO device_settings (device_id, food_amount, selected_tone, volume_level, device_ip)
-- VALUES ('pawportion-001', 5, 1, 25, '192.168.1.100');

-- INSERT INTO user_preferences (device_id, ui_theme, email)
-- VALUES ('pawportion-001', 'light', 'user@example.com');
