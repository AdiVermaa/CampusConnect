import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in the environment");
  }

  try {
    const connection = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB");
    return connection;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error?.message || error);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
};
