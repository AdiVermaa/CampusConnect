import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  let connection;
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true, // Allow multiple SQL statements
    });

    console.log("✅ Connected to MySQL database");

    // Read migration file
    const sql = fs.readFileSync(path.join(__dirname, "migration.sql"), "utf8");

    // Remove comments and split by semicolon
    const cleanedSql = sql
      .split("\n")
      .map(line => {
        // Remove full-line comments
        const commentIndex = line.indexOf("--");
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex).trim();
        }
        return line.trim();
      })
      .filter(line => line.length > 0)
      .join(" ");

    // Split by semicolon and filter out empty statements
    const statements = cleanedSql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await connection.query(statement + ";");
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (err) {
          // If column already exists, that's okay
          if (err.code === "ER_DUP_FIELDNAME" || err.message.includes("Duplicate column name")) {
            console.log(`⚠️  Statement ${i + 1}: Column already exists (skipping)`);
          } else if (err.code === "ER_TABLE_EXISTS_ERROR" || err.message.includes("already exists")) {
            console.log(`⚠️  Statement ${i + 1}: Table already exists (skipping)`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, err.message);
            throw err;
          }
        }
      }
    }

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed");
    }
  }
}

runMigration();

