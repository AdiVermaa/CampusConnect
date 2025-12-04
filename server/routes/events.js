import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import User from "../models/User.js";

const router = express.Router();

const ensureJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be defined in the environment");
    }
};

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    try {
        ensureJwtSecret();
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select("isAdmin");
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        req.user = { ...decoded, isAdmin: user.isAdmin };
        next();
    } catch (error) {
        console.error("❌ Event auth failed:", error?.message || error);
        return res.status(403).json({ error: "Invalid token" });
    }
};

const formatUser = (userDoc) =>
    userDoc
        ? {
            id: userDoc._id.toString(),
            name: userDoc.name,
            email: userDoc.email,
            profile_photo: userDoc.profile_photo || null,
        }
        : null;

const formatEvent = (eventDoc, currentUserId) => {
    const attendees = eventDoc.attendees || [];
    return {
        id: eventDoc._id.toString(),
        title: eventDoc.title,
        description: eventDoc.description,
        type: eventDoc.type,
        date: eventDoc.date,
        location: eventDoc.location || null,
        isVirtual: eventDoc.isVirtual,
        meetingLink: eventDoc.meetingLink || null,
        image: eventDoc.image || null,
        registrationLink: eventDoc.registrationLink || null,
        tags: eventDoc.tags || [],
        organizer: formatUser(eventDoc.organizer),
        attendeesCount: attendees.length,
        isAttending: attendees.some((id) => id.toString() === currentUserId),
        maxAttendees: eventDoc.maxAttendees || null,
        status: eventDoc.status,
        createdAt: eventDoc.createdAt,
        updatedAt: eventDoc.updatedAt,
        visibility: eventDoc.visibility || "public",
    };
};

router.get("/", authenticate, async (req, res) => {
    try {
        const { type, status, upcoming } = req.query;

        const filter = {};

        if (type) {
            filter.type = type;
        }

        if (status) {
            filter.status = status;
        } else if (upcoming === "true") {
            filter.status = "upcoming";
            filter.date = { $gte: new Date() };
        }

        if (!req.user.isAdmin) {
            filter.visibility = "public";
        }

        const events = await Event.find(filter)
            .sort({ date: 1 })
            .populate("organizer", "name email profile_photo");

        res.json({
            events: events.map((event) => formatEvent(event, req.user.id)),
        });
    } catch (error) {
        console.error("❌ Get events failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

router.get("/:eventId", authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID" });
        }

        const event = await Event.findById(eventId).populate(
            "organizer",
            "name email profile_photo"
        );

        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        res.json({ event: formatEvent(event, req.user.id) });
    } catch (error) {
        console.error("❌ Get event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch event" });
    }
});

router.post("/", authenticate, async (req, res) => {
    try {
        const {
            title,
            description,
            type,
            date,
            location,
            isVirtual,
            meetingLink,
            image,
            registrationLink,
            tags,
            maxAttendees,
            visibility,
        } = req.body;

        if (!title || !description || !date) {
            return res.status(400).json({
                error: "Title, description, and date are required",
            });
        }

        const event = await Event.create({
            title: title.trim(),
            description: description.trim(),
            type: type || "event",
            organizer: req.user.id,
            date: new Date(date),
            location: location?.trim() || null,
            isVirtual: Boolean(isVirtual),
            meetingLink: meetingLink?.trim() || null,
            image: image || null,
            registrationLink: registrationLink?.trim() || null,
            tags: tags || [],
            maxAttendees: maxAttendees || null,
            status: "upcoming",
            visibility: visibility || "public",
        });

        await event.populate("organizer", "name email profile_photo");

        res.status(201).json({
            message: "Event created successfully",
            event: formatEvent(event, req.user.id),
        });
    } catch (error) {
        console.error("❌ Create event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to create event" });
    }
});

router.put("/:eventId", authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID" });
        }

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ error: "Only organizer can update event" });
        }

        const {
            title,
            description,
            type,
            date,
            location,
            isVirtual,
            meetingLink,
            image,
            registrationLink,
            tags,
            maxAttendees,
            status,
            visibility,
        } = req.body;

        if (title) event.title = title.trim();
        if (description) event.description = description.trim();
        if (type) event.type = type;
        if (date) event.date = new Date(date);
        if (location !== undefined) event.location = location?.trim() || null;
        if (isVirtual !== undefined) event.isVirtual = Boolean(isVirtual);
        if (meetingLink !== undefined) event.meetingLink = meetingLink?.trim() || null;
        if (image !== undefined) event.image = image || null;
        if (registrationLink !== undefined)
            event.registrationLink = registrationLink?.trim() || null;
        if (tags) event.tags = tags;
        if (maxAttendees !== undefined) event.maxAttendees = maxAttendees || null;
        if (status) event.status = status;
        if (visibility) event.visibility = visibility;

        await event.save();
        await event.populate("organizer", "name email profile_photo");

        res.json({
            message: "Event updated successfully",
            event: formatEvent(event, req.user.id),
        });
    } catch (error) {
        console.error("❌ Update event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to update event" });
    }
});

router.delete("/:eventId", authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID" });
        }

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ error: "Only organizer can delete event" });
        }

        await Event.findByIdAndDelete(eventId);

        res.json({ message: "Event deleted successfully" });
    } catch (error) {
        console.error("❌ Delete event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to delete event" });
    }
});

router.post("/:eventId/register", authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID" });
        }

        const event = await Event.findById(eventId).populate(
            "organizer",
            "name email profile_photo"
        );

        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        const alreadyRegistered = event.attendees.some(
            (id) => id.toString() === req.user.id
        );

        if (alreadyRegistered) {
            return res.status(409).json({ error: "Already registered for this event" });
        }

        if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
            return res.status(400).json({ error: "Event is full" });
        }

        event.attendees.push(req.user.id);
        await event.save();

        res.json({
            message: "Successfully registered for event",
            event: formatEvent(event, req.user.id),
        });
    } catch (error) {
        console.error("❌ Register for event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to register for event" });
    }
});

router.delete("/:eventId/register", authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID" });
        }

        const event = await Event.findById(eventId).populate(
            "organizer",
            "name email profile_photo"
        );

        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        const isRegistered = event.attendees.some(
            (id) => id.toString() === req.user.id
        );

        if (!isRegistered) {
            return res.status(404).json({ error: "Not registered for this event" });
        }

        event.attendees = event.attendees.filter(
            (id) => id.toString() !== req.user.id
        );
        await event.save();

        res.json({
            message: "Successfully unregistered from event",
            event: formatEvent(event, req.user.id),
        });
    } catch (error) {
        console.error("❌ Unregister from event failed:", error?.message || error);
        res.status(500).json({ error: "Failed to unregister from event" });
    }
});

export default router;
