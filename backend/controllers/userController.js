// Store user locations temporarily in memory
const userLocations = {};

// Update user location
const updateLocation = (req, res) => {
    const { userId, latitude, longitude } = req.body;

    // Validate required fields
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

    // Save user location
    userLocations[userId] = {
        userId: userId,
        latitude: Number(latitude),
        longitude: Number(longitude)
    };

    console.log(
        "User location updated:",
        userLocations[userId]
    );

    // Send response
    return res.status(200).json({
        success: true,
        message: "User location updated successfully",
        data: userLocations[userId]
    });
};

// Get all user locations
const getLocations = (req, res) => {
    const locations = Object.values(userLocations);

    console.log(
        "All user locations:",
        locations
    );

    return res.status(200).json({
        success: true,
        count: locations.length,
        data: locations
    });
};

// Find users within a given distance
const nearby = (userId, radius = 100) => {
    const currentUser = userLocations[userId];

    if (!currentUser) {
        return [];
    }

    return Object.values(userLocations).filter((user) => {
        // Don't include the current user
        if (user.userId === userId) {
            return false;
        }

        const dx =
            user.latitude - currentUser.latitude;

        const dy =
            user.longitude - currentUser.longitude;

        const distance = Math.sqrt(
            (dx * dx) + (dy * dy)
        );

        return distance <= radius;
    });
};

// Export controller functions
module.exports = {
    updateLocation,
    getLocations,
    nearby
};