
/**
 * ProxiSpeak User Controller
 * Redis-backed 2D canvas location operations.
 */

const {
    saveLocation,
    getAllLocations
} = require("../models/userLocations");

const updateLocation = async (req, res) => {
    try {
        const {
            userId,
            x,
            y,
            roomId = "main-hall"
        } = req.body || {};

        if (
            typeof userId !== "string" ||
            !userId.trim() ||
           !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 || x >= 2000 ||
        y < 0 || y >= 2000 ||
            typeof roomId !== "string" ||
            !roomId.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "userId, integer x, y and roomId are required"
            });
        }

        const record = await saveLocation(userId, x, y, roomId);

        return res.status(200).json({
            success: true,
            message: "User location updated successfully",
            data: record
        });
    } catch (error) {
        console.error("Location update error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update user location"
        });
    }
};

const getLocations = async (req, res) => {
    try {
        const roomId = req.query.roomId || null;
        const locations = await getAllLocations(roomId);

        return res.status(200).json({
            success: true,
            count: locations.length,
            data: locations
        });
    } catch (error) {
        console.error("Get locations error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve locations"
        });
    }
};

const nearby = async (userId, radius = 100, roomId = "main-hall") => {
    if (
        typeof userId !== "string" ||
        !userId.trim() ||
        !Number.isFinite(radius) ||
        radius <= 0 ||
        typeof roomId !== "string" ||
        !roomId.trim()
    ) {
        return [];
    }

    const locations = await getAllLocations(roomId);

    const currentUser = locations.find(
        user => user.userId === userId
    );

    if (!currentUser) return [];

    return locations.filter(user => {
        if (user.userId === userId) return false;

        return Math.hypot(
            user.x - currentUser.x,
            user.y - currentUser.y
        ) <= radius;
    });
};

module.exports = {
    updateLocation,
    getLocations,
    nearby
};
