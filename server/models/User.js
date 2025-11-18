import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    portfolio_link: { type: String, default: null },
    linkedin_link: { type: String, default: null },
    github_link: { type: String, default: null },
    leetcode_link: { type: String, default: null },
    bio: { type: String, default: null },
    profile_photo: { type: String, default: null },
    refresh_token: { type: String, select: false },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", userSchema);

