import express from "express";
import jwt from "jsonwebtoken";
import Notification from "../models/Notification.js";

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
        console.error("❌ Notification auth failed:", error?.message || error);
        return res.status(403).json({ error: "Invalid token" });
    }
};

router.get("/", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .populate("sender", "name profile_photo")
            .limit(20);
        
        // Format notifications
        const formatted = notifications.map(n => ({
            id: n._id,
            type: n.type,
            sender: {
                id: n.sender._id,
                name: n.sender.name,
                profile_photo: n.sender.profile_photo
            },
            connectionId: n.connectionId,
            read: n.read,
            createdAt: n.createdAt
        }));

        res.json({ notifications: formatted });
    } catch (error) {
        console.error("❌ Get notifications failed:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

router.put("/:id/read", authenticate, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to update notification" });
    }
});

export default router;
