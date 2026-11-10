/**
 * ProxiSpeak Ecosystem - Auth & Worker Routes
 * Branch: Integrated / Ameya's-branch
 */

const express = require("express");
const router = express.Router();
const {
  register,
  login,
  listWorkers,
  logout
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.get("/workers", listWorkers);
router.post("/logout", logout);

module.exports = router;
