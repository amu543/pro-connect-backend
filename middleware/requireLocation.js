const ServiceProvider = require("../models/ServiceProvider");

module.exports = async function requireLocation(req, res, next) {
  try {
    const user = await ServiceProvider.findById(req.user.id);

    if (!user || !user.currentLocation || !user.currentLocation.coordinates) {
      return res.status(403).json({
        error: "Location not set. Please enable location services."
      });
    }

    const [longitude, latitude] = user.currentLocation.coordinates;

    // Default value check (0,0 = not updated)
    if (longitude === 0 && latitude === 0) {
      return res.status(403).json({
        error: "Please turn on location to continue"
      });
    }

    next();
  } catch (err) {
    console.error("Location middleware error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
