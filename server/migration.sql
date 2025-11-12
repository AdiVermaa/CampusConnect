-- Migration script to add profile fields and connections table
-- Run this SQL script in your MySQL database

-- Add profile fields to users table
-- Note: If columns already exist, you'll get an error - that's okay, just skip those lines
ALTER TABLE users 
ADD COLUMN portfolio_link VARCHAR(500) DEFAULT NULL,
ADD COLUMN linkedin_link VARCHAR(500) DEFAULT NULL,
ADD COLUMN github_link VARCHAR(500) DEFAULT NULL,
ADD COLUMN leetcode_link VARCHAR(500) DEFAULT NULL,
ADD COLUMN bio TEXT DEFAULT NULL;

-- Create connections table
CREATE TABLE IF NOT EXISTS connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  connected_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (connected_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_connection (user_id, connected_user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_connected_user_id (connected_user_id)
);

