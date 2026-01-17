const express = require("express");
const router = express.Router();
const Customer = require("../models/customer"); // ✅ Use only User model
const ServiceProvider = require("../models/ServiceProvider");

const customerAuth = require("../middleware/customerAuth");
// Debug (temporary)
console.log("loading routes/distance.js — module.id:", module.id, "module.loaded:", module.loaded);
console.log("initial module.exports:", module.exports);
// Haversine formula to calculate distance in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;

  const R = 6371; // Radius of the Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/distance/providers
 * Returns all service providers sorted by distance from logged-in customer
 */
router.get("/providers", customerAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id);

    if (!customer) return res.status(404).json({ msg: "Customer not found" });

    if (
      !customer.location ||
      !customer.location.coordinates ||
      customer.location.coordinates.length !== 2
    ) {
      return res.status(400).json({ msg: "Customer location not set" });
    }

    const customerLat = customer.location.coordinates[1]; // latitude
    const customerLng = customer.location.coordinates[0]; // longitude

    const providers = await ServiceProvider.find({ role: "provider" });

    const providersWithDistance = providers
      .map((provider) => {
        if (
          !provider.location ||
          !provider.location.coordinates ||
          provider.location.coordinates.length !== 2
        )
          return null;

        const providerLat = provider.location.coordinates[1];
        const providerLng = provider.location.coordinates[0];

        const distance = getDistanceFromLatLonInKm(
          customerLat,
          customerLng,
          providerLat,
          providerLng
        );

        return {
          id: provider._id,
          fullName: provider.fullName,
          email: provider.email,
          phone: provider.phone,
          role: provider.role,
          location: provider.location,
          distanceInKm: distance.toFixed(2),
        };
      })
      .filter((p) => p !== null); // remove providers without location

    // Sort by nearest distance
    providersWithDistance.sort((a, b) => a.distanceInKm - b.distanceInKm);

    res.json({
      msg: "Providers sorted by distance",
      count: providersWithDistance.length,
      providers: providersWithDistance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
module.exports.default = router; 