import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let isConnected = false;

const resolveMongoUri = () => {
  const env = process.env.NODE_ENV || "development";
  const primary =
    env === "production"
      ? process.env.MONGO_URI_PROD || process.env.MONGO_PROD_URI
      : process.env.MONGO_URI_DEV || process.env.MONGO_DEV_URI;

  const fallbacks = [
    primary,
    process.env.MONGO_URI,
    process.env.MONGODB_URI,
    process.env.DATABASE_URL,
  ];

  return fallbacks.find((uri) => typeof uri === "string" && uri.trim().length);
};

export const connectDB = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  const mongoUri = resolveMongoUri();

  if (!mongoUri) {
    throw new Error(
      "MongoDB connection string is missing. Please set MONGO_URI (or MONGO_URI_DEV / MONGO_URI_PROD) in the environment."
    );
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      autoIndex: true,
    });
    isConnected = true;
    console.log(
      `✅ Connected to MongoDB (${process.env.NODE_ENV || "development"})`
    );
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
