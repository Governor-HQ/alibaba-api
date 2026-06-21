-- ============================================================
-- USER ACCOUNTS — DATABASE ADDITIONS
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(80) NOT NULL,
  last_name     VARCHAR(80) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Link bookings to users (optional — existing bookings stay intact)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE seat_bookings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
