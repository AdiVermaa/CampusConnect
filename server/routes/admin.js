import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Event from "../models/Event.js";
import Connection from "../models/Connection.js";

const router = express.Router();

const ensureJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be defined in the environment");
    }
};

// Admin middleware - checks if user is admin
// For now, we'll use a simple email check. In production, add a role field to User model
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    try {
        ensureJwtSecret();
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user is admin (you can customize this logic)
        // For now, checking if email contains 'admin' or matches specific admin emails
        const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
        const isAdmin = adminEmails.includes(decoded.email) || decoded.email.includes("admin");

        if (!isAdmin) {
            return res.status(403).json({ error: "Admin access required" });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error("❌ Admin auth failed:", error?.message || error);
        return res.status(403).json({ error: "Invalid token" });
    }
};

// Get dashboard statistics
router.get("/stats", authenticateAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            totalPosts,
            totalEvents,
            totalConnections,
            recentUsers,
            recentPosts,
        ] = await Promise.all([
            User.countDocuments(),
            Post.countDocuments(),
            Event.countDocuments(),
            Connection.countDocuments(),
            User.find().sort({ createdAt: -1 }).limit(5).select("name email createdAt"),
            Post.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate("author", "name email"),
        ]);

        res.json({
            stats: {
                totalUsers,
                totalPosts,
                totalEvents,
                totalConnections,
            },
            recentUsers,
            recentPosts: recentPosts.map((post) => ({
                id: post._id.toString(),
                content: post.content.substring(0, 100),
                author: {
                    id: post.author._id.toString(),
                    name: post.author.name,
                    email: post.author.email,
                },
                createdAt: post.createdAt,
            })),
        });
    } catch (error) {
        console.error("❌ Get admin stats failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});

// Get all users with pagination
router.get("/users", authenticateAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("name email createdAt profile_photo bio"),
            User.countDocuments(),
        ]);

        res.json({
            users: users.map((user) => ({
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                profile_photo: user.profile_photo || null,
                bio: user.bio || null,
                createdAt: user.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("❌ Get users failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Delete user (admin only)
router.delete("/users/:userId", authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        // Don't allow deleting yourself
        if (userId === req.user.id) {
            return res.status(400).json({ error: "Cannot delete your own account" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Delete user's posts, connections, etc.
        await Promise.all([
            Post.deleteMany({ author: userId }),
            Connection.deleteMany({
                $or: [{ user_id: userId }, { connected_user_id: userId }],
            }),
            Event.deleteMany({ organizer: userId }),
            User.findByIdAndDelete(userId),
        ]);

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("❌ Delete user failed:", error?.message || error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// Get all posts with pagination
router.get("/posts", authenticateAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            Post.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("author", "name email"),
            Post.countDocuments(),
        ]);

        res.json({
            posts: posts.map((post) => ({
                id: post._id.toString(),
                content: post.content,
                image: post.image || null,
                author: {
                    id: post.author._id.toString(),
                    name: post.author.name,
                    email: post.author.email,
                },
                likesCount: post.likes?.length || 0,
                commentsCount: post.comments?.length || 0,
                createdAt: post.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("❌ Get posts failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch posts" });
    }
});

// Delete post (admin only)
router.delete("/posts/:postId", authenticateAdmin, async (req, res) => {
    try {
        const { postId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ error: "Invalid post ID" });
        }

        const post = await Post.findByIdAndDelete(postId);
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        res.json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error("❌ Delete post failed:", error?.message || error);
        res.status(500).json({ error: "Failed to delete post" });
    }
});

// Get all events
router.get("/events", authenticateAdmin, async (req, res) => {
    try {
        const events = await Event.find()
            .sort({ date: -1 })
            .populate("organizer", "name email");

        res.json({
            events: events.map((event) => ({
                id: event._id.toString(),
                title: event.title,
                type: event.type,
                date: event.date,
                status: event.status,
                organizer: {
                    id: event.organizer._id.toString(),
                    name: event.organizer.name,
                    email: event.organizer.email,
                },
                attendeesCount: event.attendees?.length || 0,
                createdAt: event.createdAt,
            })),
        });
    } catch (error) {
        console.error("❌ Get events failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

// Delete event (admin only)
router.delete("/events/:eventId", authenticateAdmin, async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID" });
        }

        const event = await Event.findByIdAndDelete(eventId);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        res.json({ message: "Event deleted successfully" });
    } catch (error) {
        console.error("❌ Delete event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to delete event" });
    }
});

export default router;
