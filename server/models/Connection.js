import mongoose from "mongoose";

const connectionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    connected_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

connectionSchema.index(
  { user_id: 1, connected_user_id: 1 },
  { unique: true }
);

export default mongoose.models.Connection ||
  mongoose.model("Connection", connectionSchema);

