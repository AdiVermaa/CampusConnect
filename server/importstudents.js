import fs from "fs";
import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

// 🔹 Connect to MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  } else {
    console.log("✅ Connected to MySQL Database");
  }
});

// 🔹 Read student data JSON
const data = JSON.parse(fs.readFileSync("../student_data.json", "utf-8"));

// 🔹 Track results
let insertedCount = 0;
let skippedCount = 0;

// 🔹 Insert data into student_master table
data.forEach((student) => {
  let department = student.course || "";

  // 🧠 Clean up department names
  const deptLower = department.toLowerCase();

  if (deptLower.includes("computer science and artificial intelligence")) {
    department = "B.Tech CS & AI";
  } else if (deptLower.includes("computer science and data science")) {
    department = "B.Tech CS & DS";
  } else if (deptLower.includes("design")) {
    department = "B.Des";
  } else if (deptLower.includes("entrepreneurship")) {
    department = "BBA Entrepreneurship";
  } else if (deptLower.includes("psychology")) {
    department = "BA Psychology";
  }

  // Limit to 50 chars for MySQL column
  department = department.substring(0, 50);

  const query = `
    INSERT INTO student_master (student_id, name, email, department, year)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `;

  const values = [
    student.enrollmentNo || "",
    student.nameAsPerXth || "",
    student.ruEmailID || "",
    department,
    parseInt(student.batch) || null,
  ];

  db.query(query, values, (err) => {
    if (err) {
      skippedCount++;
      console.error(`⚠️ Skipped ${student.ruEmailID}:`, err.message);
    } else {
      insertedCount++;
      console.log(`✅ Inserted/Updated ${student.ruEmailID}`);
    }

    // When done with all students, show summary
    if (insertedCount + skippedCount === data.length) {
      console.log("\n📊 Import Summary:");
      console.log(`✅ Successfully inserted/updated: ${insertedCount}`);
      console.log(`⚠️ Skipped due to errors: ${skippedCount}`);
      db.end();
    }
  });
});
