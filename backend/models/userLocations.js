/**
 * ProxiSpeak Ecosystem - User Locations Model
 * Branch: Abhishek-backend / Integrated
 * 
 * In-memory location store supporting both 2D Cartesian (x, y) coordinates
 * for the HTML5 Canvas virtual world and geographic coordinates (latitude, longitude).
 */

const userLocations = new Map();

/**
 * Save or update a user's position
 * @param {string} userId
 * @param {number} xOrLng - X coordinate or longitude
 * @param {number} yOrLat - Y coordinate or latitude
 * @param {string} [roomId='default-office']
 */
function saveLocation(userId, xOrLng, yOrLat, roomId = 'default-office') {
  if (!userId) throw new Error('userId is required');

  const x = Number(xOrLng);
  const y = Number(yOrLat);

  const record = {
    userId,
    roomId,
    x,
    y,
    longitude: x,
    latitude: y,
    updatedAt: new Date().toISOString()
  };

  userLocations.set(userId, record);
  return record;
}

/**
 * Retrieve a specific user's location
 * @param {string} userId
 */
function getLocation(userId) {
  return userLocations.get(userId) || null;
}

/**
 * Retrieve all active user locations, optionally filtered by room
 * @param {string} [roomId=null]
 */
function getAllLocations(roomId = null) {
  const records = Array.from(userLocations.values());
  if (roomId) {
    return records.filter(r => r.roomId === roomId);
  }
  return records;
}

/**
 * Remove a user's location upon disconnect
 * @param {string} userId
 */
function removeLocation(userId) {
  return userLocations.delete(userId);
}

/**
 * Clear all locations (for testing)
 */
function clearLocations() {
  userLocations.clear();
}

module.exports = {
  saveLocation,
  getLocation,
  getAllLocations,
  removeLocation,
  clearLocations
};
