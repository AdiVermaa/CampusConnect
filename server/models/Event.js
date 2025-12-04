import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
        type: {
            type: String,
            enum: ["event", "internship", "opportunity", "workshop", "competition", "other"],
            required: true,
            default: "event",
        },
        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        date: {
            type: Date,
            required: true,
        },
        location: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        isVirtual: {
            type: Boolean,
            default: false,
        },
        meetingLink: {
            type: String,
            trim: true,
        },
        image: {
            type: String,
            default: null,
        },
        registrationLink: {
            type: String,
            trim: true,
        },
        tags: {
            type: [String],
            default: [],
        },
        attendees: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        maxAttendees: {
            type: Number,
            min: 0,
        },
        status: {
            type: String,
            enum: ["upcoming", "ongoing", "completed", "cancelled"],
            default: "upcoming",
        },
        visibility: {
            type: String,
            enum: ["public", "admins_only"],
            default: "public",
        },
    },
    {
        timestamps: true,
    }
);

eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ type: 1, status: 1 });
eventSchema.index({ createdAt: -1 });

export default mongoose.models.Event || mongoose.model("Event", eventSchema);
