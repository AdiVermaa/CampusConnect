import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    student_id: { type: String, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    department: { type: String, default: "Not available" },
    year: { type: String, default: "Not available" },
  },
  {
    timestamps: true,
  }
);



export default mongoose.models.Student ||
  mongoose.model("Student", studentSchema);

