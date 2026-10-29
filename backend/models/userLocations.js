const {
    saveLocation,
    getAllLocations
} = require("../models/userLocations");

const updateLocation = (req, res) => {
    const { userId, latitude, longitude } = req.body;

    if (
        !userId ||
        latitude === undefined ||
        longitude === undefined
    ) {
        return res.status(400).json({
            success: false,
            message: "userId, latitude and longitude are required"
        });
    }

    console.log("User location received:", {
        userId,
        latitude,
        longitude
    });

    // Save user location
    saveLocation(userId, latitude, longitude);

    res.status(200).json({
        success: true,
        message: "User location updated successfully",
        data: {
            userId,
            latitude,
            longitude
        }
    });
};

const getLocations = (req, res) => {
    const locations = getAllLocations();

    res.status(200).json({
        success: true,
        count: locations.length,
        data: locations
    });
};

module.exports = {
    updateLocation,
    getLocations
};