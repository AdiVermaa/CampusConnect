import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import User from "../models/User.js";

const router = express.Router();

const ensureJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be defined in the environment");
    }
};

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    try {
        ensureJwtSecret();
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error("❌ Connection auth failed:", error?.message || error);
        return res.status(403).json({ error: "Invalid token" });
    }
};

router.get("/", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const connections = await Connection.find({
            $or: [{ user_id: userId }, { connected_user_id: userId }],
        })
            .populate("user_id", "name email profile_photo bio")
            .populate("connected_user_id", "name email profile_photo bio");

        const formattedConnections = connections
            .filter(conn => conn.user_id && conn.connected_user_id) 
            .map((conn) => {
                const isInitiator = conn.user_id._id.toString() === userId;
                const otherUser = isInitiator ? conn.connected_user_id : conn.user_id;

                return {
                    id: conn._id.toString(),
                    user: {
                        id: otherUser._id.toString(),
                        name: otherUser.name,
                        email: otherUser.email,
                        profile_photo: otherUser.profile_photo || null,
                        bio: otherUser.bio || null,
                    },
                    createdAt: conn.createdAt,
                };
            });

        res.json({ connections: formattedConnections });
    } catch (error) {
        console.error("❌ Get connections failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch connections" });
    }
});

router.post("/:userId", authenticate, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({ error: "Cannot connect with yourself" });
        }

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        const existingConnection = await Connection.findOne({
            $or: [
                { user_id: currentUserId, connected_user_id: targetUserId },
                { user_id: targetUserId, connected_user_id: currentUserId },
            ],
        });

        if (existingConnection) {
            return res.status(409).json({ error: "Connection already exists" });
        }

        const connection = await Connection.create({
            user_id: currentUserId,
            connected_user_id: targetUserId,
        });

        await connection.populate("connected_user_id", "name email profile_photo bio");

        res.status(201).json({
            message: "Connection created successfully",
            connection: {
                id: connection._id.toString(),
                user: {
                    id: connection.connected_user_id._id.toString(),
                    name: connection.connected_user_id.name,
                    email: connection.connected_user_id.email,
                    profile_photo: connection.connected_user_id.profile_photo || null,
                    bio: connection.connected_user_id.bio || null,
                },
                createdAt: connection.createdAt,
            },
        });
    } catch (error) {
        console.error("❌ Create connection failed:", error?.message || error);
        if (error.code === 11000) {
            return res.status(409).json({ error: "Connection already exists" });
        }
        res.status(500).json({ error: "Failed to create connection" });
    }
});

router.delete("/:userId", authenticate, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const result = await Connection.findOneAndDelete({
            $or: [
                { user_id: currentUserId, connected_user_id: targetUserId },
                { user_id: targetUserId, connected_user_id: currentUserId },
            ],
        });

        if (!result) {
            return res.status(404).json({ error: "Connection not found" });
        }

        res.json({ message: "Connection removed successfully" });
    } catch (error) {
        console.error("❌ Remove connection failed:", error?.message || error);
        res.status(500).json({ error: "Failed to remove connection" });
    }
});

router.get("/status/:userId", authenticate, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const connection = await Connection.findOne({
            $or: [
                { user_id: currentUserId, connected_user_id: targetUserId },
                { user_id: targetUserId, connected_user_id: currentUserId },
            ],
        });

        res.json({
            isConnected: Boolean(connection),
            connectionId: connection ? connection._id.toString() : null,
        });
    } catch (error) {
        console.error("❌ Get connection status failed:", error?.message || error);
        res.status(500).json({ error: "Failed to check connection status" });
    }
});

router.get("/user/:userId", authenticate, async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const connections = await Connection.find({
            $or: [{ user_id: targetUserId }, { connected_user_id: targetUserId }],
        })
            .populate("user_id", "name email profile_photo bio department")
            .populate("connected_user_id", "name email profile_photo bio department");

        const formattedConnections = connections
            .filter(conn => conn.user_id && conn.connected_user_id)
            .map((conn) => {
                const isInitiator = conn.user_id._id.toString() === targetUserId;
                const otherUser = isInitiator ? conn.connected_user_id : conn.user_id;

                return {
                    id: conn._id.toString(),
                    user: {
                        id: otherUser._id.toString(),
                        name: otherUser.name,
                        email: otherUser.email,
                        profile_photo: otherUser.profile_photo || null,
                        bio: otherUser.bio || null,
                        department: otherUser.department || null,
                    },
                    createdAt: conn.createdAt,
                };
            });

        res.json({ connections: formattedConnections });
    } catch (error) {
        console.error("❌ Get user connections failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch user connections" });
    }
});

export default router;
