import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Event from "../models/Event.js";
import Connection from "../models/Connection.js";
import ActivityLog from "../models/ActivityLog.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

const ensureJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be defined in the environment");
    }
};

const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    try {
        ensureJwtSecret();
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select("isAdmin email");
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: "Admin access required" });
        }

        req.user = decoded;
        req.adminUser = user;
        next();
    } catch (error) {
        console.error("❌ Admin auth failed:", error?.message || error);
        return res.status(403).json({ error: "Invalid token" });
    }
};

router.get("/stats", authenticateAdmin, async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [
            totalUsers,
            activeUsersToday,
            activeUsersWeek,
            totalPosts,
            totalEvents,
            totalConnections,
            suspendedUsers,
            recentUsers,
        ] = await Promise.all([
            User.countDocuments(),
            ActivityLog.distinct("user", {
                action: "login_success",
                createdAt: { $gte: today },
            }).then(users => users.length),
            ActivityLog.distinct("user", {
                action: "login_success",
                createdAt: { $gte: weekAgo },
            }).then(users => users.length),
            Post.countDocuments(),
            Event.countDocuments(),
            Connection.countDocuments(),
            User.countDocuments({ suspended: true }),
            User.find().sort({ createdAt: -1 }).limit(5).select("name email createdAt"),
        ]);

        res.json({
            stats: {
                totalUsers,
                activeUsersToday,
                activeUsersWeek,
                totalPosts,
                totalEvents,
                totalConnections,
                suspendedUsers,
            },
            recentUsers: recentUsers.map(u => ({
                id: u._id.toString(),
                name: u.name,
                email: u.email,
                createdAt: u.createdAt,
            })),
        });
    } catch (error) {
        console.error("❌ Get admin stats failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});

router.get("/users", authenticateAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        const searchFilter = search
            ? {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                ],
            }
            : {};

        const [users, total] = await Promise.all([
            User.find(searchFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("name email createdAt profile_photo bio isAdmin suspended suspendedAt"),
            User.countDocuments(searchFilter),
        ]);

        res.json({
            users: users.map((user) => ({
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                profile_photo: user.profile_photo || null,
                bio: user.bio || null,
                isAdmin: user.isAdmin || false,
                suspended: user.suspended || false,
                suspendedAt: user.suspendedAt || null,
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

router.put("/users/:userId", authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, bio, isAdmin } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (bio !== undefined) user.bio = bio;
        if (typeof isAdmin === "boolean") user.isAdmin = isAdmin;

        await user.save();

        await logActivity({
            userId: req.user.id,
            action: "role_change",
            targetType: "User",
            targetId: userId,
            details: { changes: req.body },
        });

        res.json({ message: "User updated successfully", user });
    } catch (error) {
        console.error("❌ Update user failed:", error?.message || error);
        res.status(500).json({ error: "Failed to update user" });
    }
});

router.post("/users/:userId/suspend", authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        if (userId === req.user.id) {
            return res.status(400).json({ error: "Cannot suspend your own account" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.suspended = true;
        user.suspendedAt = new Date();
        user.suspendedBy = req.user.id;
        await user.save();

        await logActivity({
            userId: req.user.id,
            action: "user_suspend",
            targetType: "User",
            targetId: userId,
            details: { userName: user.name, userEmail: user.email },
        });

        res.json({ message: "User suspended successfully" });
    } catch (error) {
        console.error("❌ Suspend user failed:", error?.message || error);
        res.status(500).json({ error: "Failed to suspend user" });
    }
});

router.post("/users/:userId/unsuspend", authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.suspended = false;
        user.suspendedAt = null;
        user.suspendedBy = null;
        await user.save();

        await logActivity({
            userId: req.user.id,
            action: "user_unsuspend",
            targetType: "User",
            targetId: userId,
            details: { userName: user.name, userEmail: user.email },
        });

        res.json({ message: "User unsuspended successfully" });
    } catch (error) {
        console.error("❌ Unsuspend user failed:", error?.message || error);
        res.status(500).json({ error: "Failed to unsuspend user" });
    }
});

router.delete("/users/:userId", authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        if (userId === req.user.id) {
            return res.status(400).json({ error: "Cannot delete your own account" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await Promise.all([
            Post.deleteMany({ author: userId }),
            Connection.deleteMany({
                $or: [{ user_id: userId }, { connected_user_id: userId }],
            }),
            Event.deleteMany({ organizer: userId }),
            User.findByIdAndDelete(userId),
        ]);

        await logActivity({
            userId: req.user.id,
            action: "user_delete",
            targetType: "User",
            targetId: userId,
            details: { userName: user.name, userEmail: user.email },
        });

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("❌ Delete user failed:", error?.message || error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

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
                author: post.author ? {
                    id: post.author._id.toString(),
                    name: post.author.name,
                    email: post.author.email,
                } : null,
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

        await logActivity({
            userId: req.user.id,
            action: "post_delete",
            targetType: "Post",
            targetId: postId,
            details: { content: post.content.substring(0, 100) },
        });

        res.json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error("❌ Delete post failed:", error?.message || error);
        res.status(500).json({ error: "Failed to delete post" });
    }
});

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
                organizer: event.organizer ? {
                    id: event.organizer._id.toString(),
                    name: event.organizer.name,
                    email: event.organizer.email,
                } : null,
                attendeesCount: event.attendees?.length || 0,
                createdAt: event.createdAt,
            })),
        });
    } catch (error) {
        console.error("❌ Get events failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

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

        await logActivity({
            userId: req.user.id,
            action: "event_delete",
            targetType: "Event",
            targetId: eventId,
            details: { title: event.title, type: event.type },
        });

        res.json({ message: "Event deleted successfully" });
    } catch (error) {
        console.error("❌ Delete event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to delete event" });
    }
});

router.get("/activity-logs", authenticateAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const action = req.query.action || "";

        const filter = action ? { action } : {};

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("user", "name email"),
            ActivityLog.countDocuments(filter),
        ]);

        res.json({
            logs: logs.map((log) => ({
                id: log._id.toString(),
                user: log.user ? {
                    id: log.user._id.toString(),
                    name: log.user.name,
                    email: log.user.email,
                } : null,
                action: log.action,
                targetType: log.targetType,
                targetId: log.targetId?.toString() || null,
                details: log.details,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                createdAt: log.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("❌ Get activity logs failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch activity logs" });
    }
});

router.get("/login-history", authenticateAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const filter = {
            action: { $in: ["login_success", "login_failed"] },
        };

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("user", "name email"),
            ActivityLog.countDocuments(filter),
        ]);

        res.json({
            logs: logs.map((log) => ({
                id: log._id.toString(),
                user: log.user ? {
                    id: log.user._id.toString(),
                    name: log.user.name,
                    email: log.user.email,
                } : null,
                action: log.action,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                createdAt: log.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("❌ Get login history failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch login history" });
    }
});

router.get("/failed-logins", authenticateAdmin, async (req, res) => {
    try {
        const logs = await ActivityLog.find({ action: "login_failed" })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("user", "name email");

        res.json({
            logs: logs.map((log) => ({
                id: log._id.toString(),
                user: log.user ? {
                    id: log.user._id.toString(),
                    name: log.user.name,
                    email: log.user.email,
                } : null,
                details: log.details,
                ipAddress: log.ipAddress,
                createdAt: log.createdAt,
            })),
        });
    } catch (error) {
        console.error("❌ Get failed logins failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch failed login attempts" });
    }
});

export default router;
