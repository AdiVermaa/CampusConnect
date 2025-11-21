import mongoose from "mongoose";
import { connectDB } from "./db.js";
import Student from "./models/Student.js";

await connectDB();

const student = await Student.findOne({
    email: "saina.goldfish2024@nst.rishihood.edu.in"
}).lean();

console.log("Found student:", JSON.stringify(student, null, 2));

await mongoose.disconnect();
process.exit(0);
