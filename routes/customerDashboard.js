// routes/customerDashboard.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Customer = require("../models/customer");
const ServiceTaken = require("../models/servicetaken");
const ServiceProvider = require("../models/ServiceProvider");
const Rating = require("../models/rating"); // service provider ratings
const customerAuth = require("../middleware/customerAuth");
// Haversine formula to calculate distance in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
/**
 * GET /api/dashboard/providers/:serviceType
 * Returns all providers of a service with name, ratings, services done, distance, experience, skills
 */
router.get("/providers/:Service", customerAuth, async (req, res) => {
  try {
    const {Service}= req.params;

    const customer = await Customer.findById(req.user.id);
    if (!customer || !customer.location || !customer.location.coordinates)
      return res.status(400).json({ msg: "Customer location not set" });

    const customerCoords = customer.location.coordinates; // [lng, lat]

    // 1️⃣ Find providers with serviceType
    const providers = await ServiceProvider.find({
      role: "provider",
      Service:Service,
        isVerified: true,
        isOnline: true
    });
     if (!providers.length)
      return res.status(404).json({ msg: `No providers found for ${Service}` });
    
    // 2️⃣ Map providers with distance and rating
    const providersData = await Promise.all(providers.map(async (provider) => {
      if (!provider.currentLocation?.coordinates) return null;

        const [lng, lat] = provider.currentLocation.coordinates;
      const distance = getDistanceFromLatLonInKm(customerCoords[1], customerCoords[0], lat, lng);

    

        // Average rating & total ratings
        const ratingAgg = await Rating.aggregate([
          { $match: { serviceProviderId: new mongoose.Types.ObjectId(provider._id) } },
          { $group: { _id: "$serviceProviderId", avgRating: { $avg: "$rating" }, totalRatings: { $sum: 1 } } }
        ]);
        const avgRating = ratingAgg.length ? ratingAgg[0].avgRating.toFixed(1) : 0;
        const totalRatings = ratingAgg.length ? ratingAgg[0].totalRatings : 0;

        // Number of services completed
        const servicesDone = await ServiceTaken.countDocuments({ provider: provider._id });

        return {
          id: provider._id,
          name: provider["Full Name"],
          profilePhoto: provider["Profile Photo"] || null,
          avgRating,
          totalRatings,
          servicesDone,
          distanceInKm: distance.toFixed(2),
          experience: provider["Year of Experience"] || "N/A",
          topSkills: provider["Skills / Expertise"] || []
        };
      })
    );
    // 3️⃣ Filter nulls (providers without location)
    const filteredProviders = providersData.filter(p => p !== null);

    // 4️⃣ Sort: highest rating, then nearest distance
    filteredProviders.sort((a, b) => {
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
      return a.distance - b.distance;
    });
        // 5️⃣ Notify providers via Socket.IO
    const io = req.app.get("io");
    filteredProviders.forEach(provider => {
      if (provider.socketId) {
        io.to(provider.socketId).emit("service-request", {
          customerId: customer._id,
          Service: Service
        });
      }
    });
    res.json({
      msg: `Providers for service: ${Service}`,
      providers: filteredProviders
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;