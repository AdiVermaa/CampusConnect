import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import chatRoutes from "./routes/chat.js";
import { connectDB } from "./db.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

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

const corsOptions = {
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

    return callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
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
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

const authenticateSocket = (socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(" ")[1];
  if (!token) {
    return next(new Error("No token provided"));
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET not configured"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = decoded;
    socket.join(`user:${decoded.id}`);
    next();
  } catch (error) {
    next(error);
  }
};

io.use(authenticateSocket);

io.on("connection", (socket) => {
  socket.on("conversation:join", (conversationId) => {
    if (!conversationId) return;
    socket.join(`conversation:${conversationId}`);
  });
});

app.set("io", io);

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("CampusConnect backend is running ✅");
});

const PORT = process.env.PORT || 5001;

// Connect to database before starting server
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
