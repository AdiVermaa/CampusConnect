import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { logActivity } from "../utils/activityLogger.js";

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
            status: 'accepted'
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
            status: 'pending'
        });

        await Notification.create({
            recipient: targetUserId,
            sender: currentUserId,
            type: 'connection_request',
            connectionId: connection._id
        });

        await logActivity({
            userId: currentUserId,
            action: "connection_request",
            targetType: "User",
            targetId: targetUserId,
            details: { 
                connectionId: connection._id,
                recipientName: targetUser.name,
                recipientEmail: targetUser.email
            },
            req: req,
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

        await logActivity({
            userId: currentUserId,
            action: "connection_delete",
            targetType: "User",
            targetId: targetUserId,
            details: { connectionId: result._id },
            req: req,
        });

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
            status: 'accepted'
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

router.put("/:connectionId/accept", authenticate, async (req, res) => {
    try {
        const { connectionId } = req.params;
        const userId = req.user.id;

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        if (connection.connected_user_id.toString() !== userId) {
            return res.status(403).json({ error: "Not authorized to accept this request" });
        }

        connection.status = "accepted";
        await connection.save();

        // Delete the original connection request notification
        await Notification.findOneAndDelete({
            recipient: userId,
            sender: connection.user_id,
            type: 'connection_request',
            connectionId: connection._id
        });

        // Notify sender
        await Notification.create({
            recipient: connection.user_id,
            sender: userId,
            type: 'connection_accepted',
            connectionId: connection._id
        });

        // Populate to get requester details for log
        await connection.populate("user_id", "name email");

        await logActivity({
            userId: userId,
            action: "connection_accept",
            targetType: "User",
            targetId: connection.user_id._id,
            details: { 
                connectionId: connection._id,
                requesterName: connection.user_id.name,
                requesterEmail: connection.user_id.email
            },
            req: req,
        });

        res.json({ message: "Connection accepted" });
    } catch (error) {
        console.error("❌ Accept connection failed:", error);
        res.status(500).json({ error: "Failed to accept connection" });
    }
});

router.put("/:connectionId/reject", authenticate, async (req, res) => {
    try {
        const { connectionId } = req.params;
        const userId = req.user.id;

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        if (connection.connected_user_id.toString() !== userId) {
            return res.status(403).json({ error: "Not authorized to reject this request" });
        }

        // Delete connection
        await Connection.findByIdAndDelete(connectionId);

        // Delete the original connection request notification
        await Notification.findOneAndDelete({
            recipient: userId,
            sender: connection.user_id,
            type: 'connection_request',
            connectionId: connection._id
        });

        // Notify sender
        await Notification.create({
            recipient: connection.user_id,
            sender: userId,
            type: 'connection_dismissed'
        });

        res.json({ message: "Connection rejected" });
    } catch (error) {
        console.error("❌ Reject connection failed:", error);
        res.status(500).json({ error: "Failed to reject connection" });
    }
});

router.get("/requests", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await Connection.find({
            connected_user_id: userId,
            status: 'pending'
        }).populate("user_id", "name email profile_photo");

        res.json({
            requests: requests.map(req => ({
                id: req._id,
                user: {
                    id: req.user_id._id,
                    name: req.user_id.name,
                    email: req.user_id.email,
                    profile_photo: req.user_id.profile_photo
                },
                createdAt: req.createdAt
            }))
        });
    } catch (error) {
        console.error("❌ Get requests failed:", error);
        res.status(500).json({ error: "Failed to fetch requests" });
    }
});

export default router;
