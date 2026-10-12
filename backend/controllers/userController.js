// Store user locations temporarily in memory
const locations = {};

// Update user location
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

    // Save location
    userLocations[userId] = {
        userId,
        latitude: Number(latitude),
        longitude: Number(longitude)
    };

    console.log("User location updated:", userLocations[userId]);

    res.status(200).json({
        success: true,
        message: "User location updated successfully",
        data: userLocations[userId]
    });
};

// Get all user locations
const getLocations = (req, res) => {
    const locations = Object.values(userLocations);

    console.log("All user locations:", locations);

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