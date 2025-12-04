import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                "login_success",
                "login_failed",
                "logout",
                "signup",
                "profile_update",
                "password_change",
                "post_create",
                "post_update",
                "post_delete",
                "comment_create",
                "event_create",
                "event_update",
                "event_delete",
                "connection_create",
                "connection_delete",
                "user_suspend",
                "user_unsuspend",
                "user_delete",
                "role_change",
            ],
        },
        targetType: {
            type: String,
            enum: ["User", "Post", "Event", "Connection", "Comment", null],
            default: null,
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        ipAddress: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

export default mongoose.models.ActivityLog ||
    mongoose.model("ActivityLog", activityLogSchema);
