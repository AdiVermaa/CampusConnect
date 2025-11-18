import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { connectDB, disconnectDB } from "./db.js";
import Student from "./models/Student.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.resolve(__dirname, "../student_data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const normalizeDepartment = (department = "") => {
  const deptLower = department.toLowerCase();

  if (deptLower.includes("computer science and artificial intelligence")) {
    return "B.Tech CS & AI";
  }
  if (deptLower.includes("computer science and data science")) {
    return "B.Tech CS & DS";
  }
  if (deptLower.includes("design")) {
    return "B.Des";
  }
  if (deptLower.includes("entrepreneurship")) {
    return "BBA Entrepreneurship";
  }
  if (deptLower.includes("psychology")) {
    return "BA Psychology";
  }
  return department.substring(0, 50);
};

const run = async () => {
  await connectDB();

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const student of data) {
    try {
      const payload = {
        student_id: student.enrollmentNo || "",
        name: student.nameAsPerXth || "",
        email: (student.ruEmailID || "").toLowerCase(),
        department: normalizeDepartment(student.course || "Not available"),
        year: student.batch ? String(student.batch) : "Not available",
      };

      const result = await Student.updateOne(
        { email: payload.email },
        { $set: payload },
        { upsert: true }
      );

      if (result.upsertedCount && result.upsertedCount > 0) {
        insertedCount++;
      } else if (result.modifiedCount && result.modifiedCount > 0) {
        updatedCount++;
      } else {
        skippedCount++;
      }

      console.log(`✅ Processed ${payload.email}`);
    } catch (error) {
      skippedCount++;
      console.error(
        `⚠️ Skipped ${student?.ruEmailID || "unknown"}:`,
        error?.message || error
      );
    }
  }

  console.log("\n📊 Import Summary:");
  console.log(`✅ Inserted: ${insertedCount}`);
  console.log(`🔁 Updated: ${updatedCount}`);
  console.log(`⚠️ Skipped: ${skippedCount}`);

  await disconnectDB();
  process.exit(0);
};

run().catch((error) => {
  console.error("❌ Student import failed:", error?.message || error);
  disconnectDB().finally(() => process.exit(1));
});
