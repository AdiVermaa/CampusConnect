-- Quick script to add profile_photo column if it doesn't exist
-- Run this if you already ran the main migration but profile_photo column is missing

ALTER TABLE users 
ADD COLUMN profile_photo TEXT DEFAULT NULL;

