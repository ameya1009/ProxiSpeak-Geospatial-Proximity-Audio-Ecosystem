/**
 * ProxiSpeak Ecosystem - Auth & Worker Controller
 * Branch: Integrated / Ameya's-branch
 *
 * Implements employee registration, worker login, and office directory endpoints.
 */

const {
  registerWorker,
  getWorker,
  getAllWorkers,
  removeLocation
} = require("../models/userLocations");

/**
 * POST /api/auth/register
 * Registers a new office worker
 */
const register = (req, res) => {
  const { workerId, name, email, department, avatarColor } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Worker name is required"
    });
  }

  try {
    const worker = registerWorker({ workerId, name, email, department, avatarColor });
    return res.status(201).json({
      success: true,
      message: "Office worker registered successfully",
      worker
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * POST /api/auth/login
 * Authenticates or logs in an existing office worker
 */
const login = (req, res) => {
  const { workerId, name } = req.body;

  if (!workerId && !name) {
    return res.status(400).json({
      success: false,
      message: "Either workerId or name is required to enter the office"
    });
  }

  const all = getAllWorkers();
  let worker = null;

  if (workerId) {
    worker = getWorker(workerId);
  }

  if (!worker && name) {
    const query = name.trim().toLowerCase();
    worker = all.find(w => w.name.toLowerCase() === query || w.workerId.toLowerCase() === query);
  }

  // If worker not found by ID/name, auto-register for frictionless entry
  if (!worker && name) {
    worker = registerWorker({
      name: name.trim(),
      department: req.body.department || "Engineering",
      avatarColor: req.body.avatarColor || "#0284c7"
    });
  }

  if (!worker) {
    return res.status(404).json({
      success: false,
      message: "Worker profile not found. Please register first."
    });
  }

  return res.status(200).json({
    success: true,
    message: `Welcome to the office, ${worker.name}!`,
    worker
  });
};

/**
 * GET /api/auth/workers
 * Returns list of registered office workers
 */
const listWorkers = (req, res) => {
  const workers = getAllWorkers();
  return res.status(200).json({
    success: true,
    count: workers.length,
    workers
  });
};

/**
 * POST /api/auth/logout
 * Evicts user from office and removes from active locations
 */
const logout = (req, res) => {
  const { workerId, userId } = req.body;
  const targetId = userId || workerId;

  if (targetId) {
    removeLocation(targetId);
  }

  return res.status(200).json({
    success: true,
    message: "Logged out from office floor successfully"
  });
};

module.exports = {
  register,
  login,
  listWorkers,
  logout
};
