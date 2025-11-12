import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

/* ================================
   🔹 SIGNUP ROUTE
================================ */
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  console.log("🟢 Received signup request:", req.body);

  // ✅ 1. Allow only college email IDs
  if (!email || !email.includes("rishihood.edu.in")) {
    return res.status(403).json({ error: "Only college email IDs are allowed" });
  }

  // ✅ 2. Check if user already exists in `users` table
  db.query("SELECT * FROM users WHERE email = ?", [email], async (errUser, existing) => {
    if (errUser) {
      console.error("❌ Database error (user check):", errUser);
      return res.status(500).json({ error: "Database error" });
    }

    if (existing.length > 0) {
      return res.status(409).json({ error: "User already registered. Please login instead." });
    }

    // ✅ 3. Check if the student exists in the `student_master` table
    db.query("SELECT * FROM student_master WHERE email = ?", [email], async (err, result) => {
      if (err) {
        console.error("❌ Database error (student check):", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (result.length === 0) {
        return res.status(403).json({ error: "Access denied. Not a registered Rishihood student." });
      }

      // ✅ 4. Hash password and insert user into `users` table
      const hashed = await bcrypt.hash(password, 10);

      db.query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashed],
        (err2) => {
          if (err2) {
            console.error("❌ Insert error:", err2.message);
            return res.status(500).json({ error: err2.message });
          }
          res.json({ message: "Signup successful 🎉" });
        }
      );
    });
  });
});

/* ================================
   🔹 LOGIN ROUTE
================================ */
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("🔵 Login attempt for:", email);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.error("❌ Database error (login):", err.message);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (results.length === 0) {
      console.log("⚠️ User not found:", email);
      return res.status(404).json({ error: "User not found" });
    }

    const user = results[0];
    const valid = await bcrypt.compare(password, user.password);
    
    if (!valid) {
      console.log("⚠️ Invalid password for:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET not set in environment");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("✅ Login successful for:", email);
    res.json({ message: "Login successful", token });
  });
});

/* ================================
   🔹 GET USER DETAILS (/me)
================================ */
router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ JWT verify failed:", err?.message);
      return res.status(403).json({ error: "Invalid token" });
    }

    // ✅ Fetch basic user data - try with profile fields first, fallback to basic if columns don't exist
    db.query("SELECT * FROM users WHERE id = ?", [decoded.id], (err1, userResults) => {
      if (err1) {
        console.error("❌ Database error (/me users):", err1?.message);
        return res.status(500).json({ error: "Database error" });
      }

      if (userResults.length === 0)
        return res.status(404).json({ error: "User not found" });

      const user = userResults[0];

      // ✅ Fetch extra student data (handle errors gracefully)
      db.query(
        "SELECT department, year FROM student_master WHERE email = ?",
        [user.email],
        (err2, studentResults) => {
          // If student_master table doesn't exist or query fails, use defaults
          let student = { department: "Not available", year: "Not available" };
          
          if (!err2 && studentResults.length > 0) {
            student = studentResults[0];
          } else if (err2) {
            console.warn("⚠️ Could not fetch student data (table may not exist):", err2?.message);
          }

          // ✅ Get connections count (handle if table doesn't exist)
          db.query(
            "SELECT COUNT(*) as count FROM connections WHERE user_id = ? OR connected_user_id = ?",
            [decoded.id, decoded.id],
            (err3, connResults) => {
              // If connections table doesn't exist, just use 0
              const connectionsCount = err3 ? 0 : (connResults[0]?.count || 0);
              
              if (err3) {
                console.warn("⚠️ Could not fetch connections count (table may not exist):", err3?.message);
              }

              // ✅ Send merged response with safe access to optional fields
              res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                department: student.department || "Not available",
                year: student.year || "Not available",
                portfolio_link: user.portfolio_link || "",
                linkedin_link: user.linkedin_link || "",
                github_link: user.github_link || "",
                leetcode_link: user.leetcode_link || "",
                bio: user.bio || "",
                connections_count: connectionsCount,
              });
            }
          );
        }
      );
    });
  });
});
 
/* ================================
   🔹 SEARCH USERS (/search?query=...)
  - Searches users by name or email
  - Requires Authorization: Bearer <token>
================================ */
router.get("/search", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const { query } = req.query;

  if (!query || query.trim().length === 0) {
    return res.json({ results: [] });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err) => {
    if (err) {
      console.error("❌ JWT verify failed (search):", err?.message);
      return res.status(403).json({ error: "Invalid token" });
    }

    const like = `%${query}%`;
    db.query(
      "SELECT id, name, email FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY name ASC LIMIT 10",
      [like, like],
      (err2, results) => {
        if (err2) {
          console.error("❌ Database error (/search):", err2?.message);
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ results });
      }
    );
  });
});

/* ================================
   🔹 GET USER PROFILE (/profile/:userId)
  - Gets full profile of any user
  - Requires Authorization: Bearer <token>
================================ */
router.get("/profile/:userId", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const { userId } = req.params;

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ JWT verify failed (profile):", err?.message);
      return res.status(403).json({ error: "Invalid token" });
    }

    // Fetch user profile - use SELECT * to handle missing columns gracefully
    db.query("SELECT * FROM users WHERE id = ?", [userId], (err1, userResults) => {
      if (err1) {
        console.error("❌ Database error (profile):", err1?.message);
        return res.status(500).json({ error: "Database error" });
      }

      if (userResults.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResults[0];

      // Fetch student data (handle errors gracefully)
      db.query(
        "SELECT department, year FROM student_master WHERE email = ?",
        [user.email],
        (err2, studentResults) => {
          // If student_master table doesn't exist or query fails, use defaults
          let student = { department: "Not available", year: "Not available" };
          
          if (!err2 && studentResults.length > 0) {
            student = studentResults[0];
          } else if (err2) {
            console.warn("⚠️ Could not fetch student data (profile):", err2?.message);
          }

          // Get connections count (handle if table doesn't exist)
          db.query(
            "SELECT COUNT(*) as count FROM connections WHERE user_id = ? OR connected_user_id = ?",
            [userId, userId],
            (err3, connResults) => {
              const connectionsCount = err3 ? 0 : (connResults[0]?.count || 0);
              
              if (err3) {
                console.warn("⚠️ Could not fetch connections count (profile):", err3?.message);
              }

              // Check if current user is connected to this user
              db.query(
                "SELECT * FROM connections WHERE (user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?)",
                [decoded.id, userId, userId, decoded.id],
                (err4, isConnectedResults) => {
                  if (err4) {
                    console.warn("⚠️ Could not check connection status:", err4?.message);
                  }

                  res.json({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    department: student.department || "Not available",
                    year: student.year || "Not available",
                    portfolio_link: user.portfolio_link || "",
                    linkedin_link: user.linkedin_link || "",
                    github_link: user.github_link || "",
                    leetcode_link: user.leetcode_link || "",
                    bio: user.bio || "",
                    connections_count: connectionsCount,
                    is_connected: err4 ? false : (isConnectedResults.length > 0),
                    is_own_profile: decoded.id === parseInt(userId),
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});

/* ================================
   🔹 UPDATE USER PROFILE (PUT /profile)
  - Updates current user's profile
  - Requires Authorization: Bearer <token>
================================ */
router.put("/profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const { portfolio_link, linkedin_link, github_link, leetcode_link, bio } = req.body;

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ JWT verify failed (update profile):", err?.message);
      return res.status(403).json({ error: "Invalid token" });
    }

    db.query(
      "UPDATE users SET portfolio_link = ?, linkedin_link = ?, github_link = ?, leetcode_link = ?, bio = ? WHERE id = ?",
      [portfolio_link || null, linkedin_link || null, github_link || null, leetcode_link || null, bio || null, decoded.id],
      (err1) => {
        if (err1) {
          console.error("❌ Database error (update profile):", err1?.message);
          // If columns don't exist, provide helpful error message
          if (err1.message.includes("Unknown column")) {
            return res.status(500).json({ 
              error: "Profile fields not available. Please run the database migration first." 
            });
          }
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "Profile updated successfully" });
      }
    );
  });
});

/* ================================
   🔹 CONNECT TO USER (POST /connect/:userId)
  - Creates a connection between current user and target user
  - Requires Authorization: Bearer <token>
================================ */
router.post("/connect/:userId", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  const { userId } = req.params;

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ JWT verify failed (connect):", err?.message);
      return res.status(403).json({ error: "Invalid token" });
    }

    if (decoded.id === parseInt(userId)) {
      return res.status(400).json({ error: "Cannot connect to yourself" });
    }

    // Check if connection already exists
    db.query(
      "SELECT * FROM connections WHERE (user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?)",
      [decoded.id, userId, userId, decoded.id],
      (err1, existing) => {
        if (err1) {
          // If connections table doesn't exist, provide helpful message
          if (err1.message.includes("doesn't exist")) {
            console.warn("⚠️ Connections table doesn't exist");
            return res.status(500).json({ 
              error: "Connections feature not available. Please run the database migration first." 
            });
          }
          console.error("❌ Database error (check connection):", err1?.message);
          return res.status(500).json({ error: "Database error" });
        }

        if (existing.length > 0) {
          return res.status(409).json({ error: "Already connected" });
        }

        // Create connection
        db.query(
          "INSERT INTO connections (user_id, connected_user_id) VALUES (?, ?)",
          [decoded.id, userId],
          (err2) => {
            if (err2) {
              // If connections table doesn't exist, provide helpful message
              if (err2.message.includes("doesn't exist")) {
                console.warn("⚠️ Connections table doesn't exist");
                return res.status(500).json({ 
                  error: "Connections feature not available. Please run the database migration first." 
                });
              }
              console.error("❌ Database error (create connection):", err2?.message);
              return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Connected successfully" });
          }
        );
      }
    );
  });
});

/* ================================
   🔹 GET CONNECTIONS COUNT (GET /connections/count)
  - Gets current user's connections count
  - Requires Authorization: Bearer <token>
================================ */
router.get("/connections/count", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ JWT verify failed (connections count):", err?.message);
      return res.status(403).json({ error: "Invalid token" });
    }

    db.query(
      "SELECT COUNT(*) as count FROM connections WHERE user_id = ? OR connected_user_id = ?",
      [decoded.id, decoded.id],
      (err1, results) => {
        if (err1) {
          console.error("❌ Database error (connections count):", err1?.message);
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ count: results[0]?.count || 0 });
      }
    );
  });
});

export default router;
