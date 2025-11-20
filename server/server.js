import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import { connectDB } from "./db.js";


dotenv.config();

const app = express();

connectDB();

const envOriginList =
  process.env.CLIENT_ORIGINS?.split(",").map((o) => o.trim()) || [];

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.CLIENT_ORIGIN, 
  ...envOriginList,
  "https://campus-connect-six-liard.vercel.app",
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ""))
  .filter((value, index, self) => self.indexOf(value) === index);

if (process.env.NODE_ENV === "production") {
  console.log("🌐 Allowed CORS origins:", allowedOrigins);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV === "production") {
        console.warn("⚠️ CORS blocked origin:", origin);
        console.warn("   Normalized:", normalizedOrigin);
        console.warn("   Allowed origins:", allowedOrigins);
      }

      return callback(
        new Error(`CORS policy: Origin ${origin} is not allowed`)
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Length", "Content-Type"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

app.get("/", (req, res) => {
  res.send("CampusConnect backend is running ✅");
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
