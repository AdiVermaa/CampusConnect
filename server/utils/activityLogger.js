import ActivityLog from "../models/ActivityLog.js";

export const logActivity = async ({
    userId,
    action,
    targetType = null,
    targetId = null,
    details = {},
    req = null,
}) => {
    try {
        const logData = {
            user: userId,
            action,
            targetType,
            targetId,
            details,
        };

        if (req) {
            logData.ipAddress = req.ip || req.connection?.remoteAddress || null;
            logData.userAgent = req.get("user-agent") || null;
        }

        await ActivityLog.create(logData);
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
};
