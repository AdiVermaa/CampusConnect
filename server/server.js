import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import { connectDB } from "./db.js";


dotenv.config();

const app = express();

connectDB();

const envOriginList =
  process.env.CLIENT_ORIGINS?.split(",").map((o) => o.trim()) || [];

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.CLIENT_ORIGIN, // single origin env var
  ...envOriginList,
]
  .filter(Boolean)
  .filter((value, index, self) => self.indexOf(value) === index);

// Log allowed origins in production for debugging
if (process.env.NODE_ENV === "production") {
  console.log("🌐 Allowed CORS origins:", allowedOrigins);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Log blocked origins in production for debugging
      if (process.env.NODE_ENV === "production") {
        console.warn("⚠️ CORS blocked origin:", origin);
        console.warn("   Allowed origins:", allowedOrigins);
      }

      return callback(
        new Error(`CORS policy: Origin ${origin} is not allowed`)
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(cookieParser());
// Increase body size limit to handle base64 image uploads (50MB)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("CampusConnect backend is running ✅");
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
