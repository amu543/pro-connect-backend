console.log("loading routes/location.js — module.id:", module.id, "module.loaded:", module.loaded);
console.log("initial module.exports:", module.exports);
const express = require("express");
const router = express.Router();
const Customer = require("../models/customer");
const auth = require("../middleware/customerAuth");

router.post("/update", auth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ msg: "Latitude & longitude required" });
    }

    await Customer.findByIdAndUpdate(req.user.id, {
      location: {
        type: "Point",
        coordinates: [longitude, latitude]
      }
    });

    res.json({ msg: "Location updated successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});
console.log("before export — router type:", typeof router, "router keys:", Object.getOwnPropertyNames(router));

//to fetch location for map 
router.get("/my-location", auth, async (req, res) => {
  const customer = await Customer.findById(req.user.id).select("location");

  if (!customer || !customer.location) {
    return res.status(404).json({ msg: "Location not found" });
  }

  res.json({
    latitude: customer.location.coordinates[1],
    longitude: customer.location.coordinates[0]
  });
});

module.exports = router;
module.exports.default = router; 
// supports some interop cases