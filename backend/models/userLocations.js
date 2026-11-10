/**
 * ProxiSpeak Ecosystem - User Locations Model
 * Branch: Abhishek-backend / Integrated
 * 
 * In-memory location store supporting both 2D Cartesian (x, y) coordinates
 * for the HTML5 Canvas virtual world and geographic coordinates (latitude, longitude).
 */

const userLocations = new Map();
const registeredWorkers = new Map();

// Pre-register official team members for seamless login/demo
const DEFAULT_WORKERS = [
  { workerId: "EMP-001", name: "Ameya Sharma", email: "ameya@proxispeak.io", department: "Team Lead & Audio DSP", avatarColor: "#0284c7" },
  { workerId: "EMP-002", name: "Harpreet Kaur", email: "harpreet@proxispeak.io", department: "Frontend & 2D World", avatarColor: "#10b981" },
  { workerId: "EMP-003", name: "Abhishek Verma", email: "abhishek@proxispeak.io", department: "Backend & Signaling", avatarColor: "#f59e0b" },
  { workerId: "EMP-004", name: "Milind Kumar", email: "milind@proxispeak.io", department: "Database & Geospatial", avatarColor: "#a855f7" }
];

DEFAULT_WORKERS.forEach(w => registeredWorkers.set(w.workerId, w));

/**
 * Register or update an office worker
 */
function registerWorker({ workerId, name, email, department, avatarColor }) {
  if (!name) throw new Error("Worker name is required");
  const id = workerId || "EMP-" + Math.floor(100 + Math.random() * 900);
  const profile = {
    workerId: id,
    name: name.trim(),
    email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@proxispeak.io`,
    department: department || "Engineering",
    avatarColor: avatarColor || "#0284c7",
    registeredAt: new Date().toISOString()
  };
  registeredWorkers.set(id, profile);
  return profile;
}

/**
 * Get registered worker profile
 */
function getWorker(workerId) {
  return registeredWorkers.get(workerId) || null;
}

/**
 * List all registered office workers
 */
function getAllWorkers() {
  return Array.from(registeredWorkers.values());
}

/**
 * Save or update a user's position
 * @param {string} userId
 * @param {number} xOrLng - X coordinate or longitude
 * @param {number} yOrLat - Y coordinate or latitude
 * @param {string} [roomId='default-office']
 * @param {object} [metadata={}]
 */
function saveLocation(userId, xOrLng, yOrLat, roomId = 'default-office', metadata = {}) {
  if (!userId) throw new Error('userId is required');

  const x = Number(xOrLng);
  const y = Number(yOrLat);

  // Look up if user matches a registered worker
  const existingWorker = registeredWorkers.get(userId);

  const record = {
    userId,
    roomId,
    x,
    y,
    longitude: x,
    latitude: y,
    name: metadata.name || (existingWorker ? existingWorker.name : userId),
    department: metadata.department || (existingWorker ? existingWorker.department : "Engineering"),
    avatarColor: metadata.avatarColor || (existingWorker ? existingWorker.avatarColor : "#0284c7"),
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
  registerWorker,
  getWorker,
  getAllWorkers,
  saveLocation,
  getLocation,
  getAllLocations,
  removeLocation,
  clearLocations
};
