
const express = require("express");
const router = express.Router();

const {
    updateLocation,
    getLocations,
    nearby
} = require("../controllers/userController");

// Update user location
router.post("/location", updateLocation);

// Get locations
router.get("/locations", getLocations);

// Get nearby users
router.get("/nearby", async (req, res) => {
    try {
        const {
            userId,
            roomId = "main-hall",
            radius = "100"
        } = req.query;

        if (
            typeof userId !== "string" ||
            !userId.trim() ||
            typeof roomId !== "string" ||
            !roomId.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "userId and roomId are required"
            });
        }

        const parsedRadius = Number(radius);

        if (
            !Number.isFinite(parsedRadius) ||
            parsedRadius <= 0 ||
            parsedRadius > 120
        ) {
            return res.status(400).json({
                success: false,
                message: "Radius must be greater than 0 and at most 120"
            });
        }

        const nearbyUsers = await nearby(
            userId,
            parsedRadius,
            roomId
        );

        return res.status(200).json({
            success: true,
            count: nearbyUsers.length,
            data: nearbyUsers
        });
    } catch (error) {
        console.error("Nearby users error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve nearby users"
        });
    }
});

module.exports = router;
