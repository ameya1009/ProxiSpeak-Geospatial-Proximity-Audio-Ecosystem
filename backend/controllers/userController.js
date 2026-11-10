/**
 * ProxiSpeak Ecosystem - User Controller
 * Branch: Abhishek-backend / Integrated
 *
 * Exposes REST endpoints for avatar positioning and active user discovery.
 */

const {
  saveLocation,
  getLocation,
  getAllLocations,
  removeLocation
} = require("../models/userLocations");

/**
 * POST /api/users/location
 * Updates avatar location supporting both (x, y) Cartesian and (latitude, longitude)
 */
const updateLocation = (req, res) => {
  const { userId, x, y, latitude, longitude, roomId } = req.body;

  // Resolve coordinates
  const posX = x !== undefined ? x : longitude;
  const posY = y !== undefined ? y : latitude;

  if (!userId || posX === undefined || posY === undefined) {
    return res.status(400).json({
      success: false,
      message: "userId, and either (x, y) or (latitude, longitude) coordinates are required"
    });
  }

  const record = saveLocation(userId, posX, posY, roomId || "default-office");

  return res.status(200).json({
    success: true,
    message: "User location updated successfully",
    data: record
  });
};

/**
 * GET /api/users/locations
 * Returns all active user coordinates
 */
const getLocations = (req, res) => {
  const roomId = req.query.roomId || null;
  const locations = getAllLocations(roomId);

  return res.status(200).json({
    success: true,
    count: locations.length,
    data: locations
  });
};

/**
 * GET /api/users/:userId/location
 * Returns single user coordinate
 */
const getUserLocation = (req, res) => {
  const { userId } = req.params;
  const record = getLocation(userId);

  if (!record) {
    return res.status(404).json({
      success: false,
      message: `User '${userId}' location not found`
    });
  }

  return res.status(200).json({
    success: true,
    data: record
  });
};

module.exports = {
  updateLocation,
  getLocations,
  getUserLocation
};
