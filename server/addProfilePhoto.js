import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addProfilePhotoColumn() {
  let connection;
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("✅ Connected to MySQL database");

    // Check if column already exists
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'profile_photo'"
    );

    if (columns.length > 0) {
      console.log("✅ profile_photo column already exists");
      return;
    }

    // Add the column
    await connection.query(
      "ALTER TABLE users ADD COLUMN profile_photo TEXT DEFAULT NULL"
    );

    console.log("✅ profile_photo column added successfully!");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("✅ profile_photo column already exists");
    } else {
      console.error("❌ Failed to add profile_photo column:", error.message);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed");
    }
  }
}

addProfilePhotoColumn();

