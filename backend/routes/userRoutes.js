const express = require("express");
const router = express.Router();

const {
    updateLocation,
    getLocations
} = require("../controllers/userController");

router.post("/location", updateLocation);

router.get("/locations", getLocations);

module.exports = router;