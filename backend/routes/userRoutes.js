const express = require("express");

const router = express.Router();

const {
    updateLocation,
    getLocations,
    nearby
} = require("../controllers/userController");

// Update user location
router.post("/location", updateLocation);

// Get all user locations
router.get("/locations", getLocations);

// Get nearby users
router.get("/nearby", (req, res) => {
    const { userId, radius } = req.query;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "userId is required"
        });
    }

    const nearbyUsers = nearby(
        userId,
        Number(radius) || 100
    );

    return res.status(200).json({
        success: true,
        count: nearbyUsers.length,
        data: nearbyUsers
    });
});

module.exports = router;