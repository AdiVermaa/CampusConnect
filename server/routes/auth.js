import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Student from "../models/Student.js";
import Connection from "../models/Connection.js";

dotenv.config();

const router = express.Router();
const { Types } = mongoose;

const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const ensureJwtSecrets = () => {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_SECRET and JWT_REFRESH_SECRET must be defined in the environment"
    );
  }
};

const sanitizeUser = (userDoc) => ({
  id: userDoc._id.toString(),
  name: userDoc.name,
  email: userDoc.email,
  portfolio_link: userDoc.portfolio_link || "",
  linkedin_link: userDoc.linkedin_link || "",
  github_link: userDoc.github_link || "",
  leetcode_link: userDoc.leetcode_link || "",
  bio: userDoc.bio || "",
  profile_photo: userDoc.profile_photo || null,
});

function extractYearFromEmail(email) {
  if (!email) return null;

  const fourDigitMatch = email.match(/(20\d{2})/);
  if (fourDigitMatch) {
    return fourDigitMatch[1];
  }

  const twoDigitMatch = email.match(/(\d{2})(?![0-9])/);
  if (twoDigitMatch) {
    const twoDigit = parseInt(twoDigitMatch[1], 10);
    if (twoDigit >= 0 && twoDigit <= 99) {
      return `20${twoDigit.toString().padStart(2, "0")}`;
    }
  }

  return null;
}

const getStudentMeta = async (email) => {
  try {
    const student = await Student.findOne({ email }).lean();
    if (!student) {
      return { department: "Not available", year: "Not available" };
    }
    return {
      department: student.department || "Not available",
      year: student.year || "Not available",
    };
  } catch (error) {
    console.warn("⚠️ Could not fetch student data:", error?.message);
    return { department: "Not available", year: "Not available" };
  }
};

const getConnectionsCount = async (userId) => {
  try {
    return await Connection.countDocuments({
      $or: [{ user_id: userId }, { connected_user_id: userId }],
    });
  } catch (error) {
    console.warn(
      "⚠️ Could not fetch connections count:",
      error?.message || error
    );
    return 0;
  }
};

const isValidObjectId = (id) => Types.ObjectId.isValid(id);

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  console.log("🟢 Received signup request:", email);

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password required" });
  }

  if (!email.includes("rishihood.edu.in")) {
    return res
      .status(403)
      .json({ error: "Only college email IDs are allowed" });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ error: "User already registered. Please login instead." });
    }

    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(403).json({
        error: "Access denied. Not a registered Rishihood student.",
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed });

    res.json({ message: "Signup successful 🎉" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error("❌ Signup failed:", error?.message || error);
    res.status(500).json({ error: "Failed to sign up" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("🔵 Login attempt for:", email);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    ensureJwtSecrets();

    const user = await User.findOne({ email })
      .select("+password +refresh_token")
      .exec();

    if (!user) {
      console.log("⚠️ User not found:", email);
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log("⚠️ Invalid password for:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload = { id: user._id.toString(), email: user.email };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    user.refresh_token = refreshToken;
    await user.save();

    console.log("✅ Login successful for:", email);

    res
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json({
        message: "Login successful",
        accessToken,
      });
  } catch (error) {
    console.error("❌ Login failed:", error?.message || error);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.cookies || {};

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token provided" });
  }

  try {
    ensureJwtSecrets();
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // If the token came from the old SQL-based system, its id will not be
    // a valid Mongo ObjectId – treat it as invalid and clear the cookie.
    if (!isValidObjectId(decoded.id)) {
      return res
        .clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 })
        .status(403)
        .json({ error: "Invalid refresh token" });
    }

    const user = await User.findOne({
      _id: decoded.id,
      refresh_token: refreshToken,
    }).select("+refresh_token");

    if (!user) {
      return res.status(403).json({ error: "Refresh token not recognized" });
    }

    const accessToken = jwt.sign(
      { id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error("❌ Refresh token flow failed:", error?.message || error);
    const isJwtError =
      error.name === "JsonWebTokenError" || error.name === "TokenExpiredError";

    if (isJwtError) {
    return res
      .clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 })
        .status(403)
        .json({ error: "Invalid refresh token" });
    }

    res.status(500).json({ error: "Failed to refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = req.cookies || {};

  if (refreshToken && process.env.JWT_REFRESH_SECRET) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      await User.findByIdAndUpdate(decoded.id, {
        $unset: { refresh_token: "" },
      }).exec();
    } catch (error) {
      console.warn("⚠️ Logout token cleanup skipped:", error?.message || error);
    }
  }

  res
    .clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 })
    .json({ message: "Logged out" });
});

router.delete("/delete-account", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    ensureJwtSecrets();
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    await Connection.deleteMany({
      $or: [{ user_id: userId }, { connected_user_id: userId }],
    });
    await User.findByIdAndDelete(userId);

    res
      .clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 })
      .json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("❌ Delete account failed:", error?.message || error);
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  try {
    ensureJwtSecrets();
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const studentMeta = await getStudentMeta(user.email);
    let year = studentMeta.year;
    if (!year || year === "Not available") {
      year = extractYearFromEmail(user.email) || "Not available";
    }

    const connectionsCount = await getConnectionsCount(user._id);

    res.json({
      ...sanitizeUser(user),
      department: studentMeta.department,
      year,
      connections_count: connectionsCount,
    });
  } catch (error) {
    console.error("❌ /me failed:", error?.message || error);
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

router.get("/search", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const { query } = req.query;

  if (!query || query.trim().length === 0) {
    return res.json({ results: [] });
  }

  try {
    ensureJwtSecrets();
    jwt.verify(token, process.env.JWT_SECRET);

    const regex = new RegExp(query.trim(), "i");
    const results = await User.find({
      $or: [{ name: regex }, { email: regex }],
    })
      .limit(10)
      .sort({ name: 1 })
      .select("name email")
      .lean();

    res.json({
      results: results.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      })),
    });
  } catch (error) {
    console.error("❌ Search failed:", error?.message || error);
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

router.get("/profile/:userId", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    ensureJwtSecrets();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const studentMeta = await getStudentMeta(user.email);
    let year = studentMeta.year;
    if (!year || year === "Not available") {
      year = extractYearFromEmail(user.email) || "Not available";
    }

    const [connectionsCount, isConnected] = await Promise.all([
      getConnectionsCount(user._id),
      Connection.exists({
        $or: [
          { user_id: decoded.id, connected_user_id: userId },
          { user_id: userId, connected_user_id: decoded.id },
        ],
      }),
    ]);

    res.json({
      ...sanitizeUser(user),
      department: studentMeta.department,
      year,
      connections_count: connectionsCount,
      is_connected: Boolean(isConnected),
      is_own_profile: decoded.id === user._id.toString(),
    });
  } catch (error) {
    console.error("❌ Get profile failed:", error?.message || error);
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

router.put("/profile", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const updates = req.body || {};

  const allowedFields = [
    "name",
    "portfolio_link",
    "linkedin_link",
    "github_link",
    "leetcode_link",
    "bio",
    "profile_photo",
  ];

  const payload = Object.entries(updates)
    .filter(([key]) => allowedFields.includes(key))
    .reduce((acc, [key, value]) => {
      acc[key] = value ?? null;
      return acc;
    }, {});

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    ensureJwtSecrets();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await User.findByIdAndUpdate(decoded.id, payload).exec();

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("❌ Update profile failed:", error?.message || error);
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

router.post("/connect/:userId", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    ensureJwtSecrets();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.id === userId) {
      return res.status(400).json({ error: "Cannot connect to yourself" });
    }

    const sortedIds = [decoded.id, userId]
      .map((id) => id.toString())
      .sort((a, b) => a.localeCompare(b));

    const [primary, secondary] = sortedIds.map((id) => new Types.ObjectId(id));

    const existing = await Connection.findOne({
      user_id: primary,
      connected_user_id: secondary,
    }).lean();

    if (existing) {
      return res.status(409).json({ error: "Already connected" });
    }

    await Connection.create({
      user_id: primary,
      connected_user_id: secondary,
    });

    res.json({ message: "Connected successfully" });
  } catch (error) {
    console.error("❌ Connect failed:", error?.message || error);
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

router.get("/connections/count", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    ensureJwtSecrets();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const count = await getConnectionsCount(decoded.id);
    res.json({ count });
  } catch (error) {
    console.error(
      "❌ Connections count failed:",
      error?.message || error,
    );
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

router.get("/connections/list", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    ensureJwtSecrets();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const connections = await Connection.find({
      $or: [
        { user_id: decoded.id },
        { connected_user_id: decoded.id },
      ],
    }).lean();

    const otherUserIds = new Set();

    connections.forEach((conn) => {
      if (conn.user_id.toString() === decoded.id) {
        otherUserIds.add(conn.connected_user_id.toString());
      } else {
        otherUserIds.add(conn.user_id.toString());
      }
    });

    if (otherUserIds.size === 0) {
      return res.json({ connections: [] });
    }

    const users = await User.find({
      _id: { $in: Array.from(otherUserIds) },
    }).select("name email profile_photo");

    res.json({
      connections: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profile_photo: user.profile_photo || null,
      })),
    });
  } catch (error) {
    console.error(
      "❌ Connections list failed:",
      error?.message || error,
    );
    const status = error.name === "JsonWebTokenError" ? 403 : 500;
    res
      .status(status)
      .json({ error: status === 403 ? "Invalid token" : "Database error" });
  }
});

export default router;
