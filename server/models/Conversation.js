import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    isGroup: { type: Boolean, default: false },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1 });

export default mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

