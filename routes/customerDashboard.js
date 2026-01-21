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
 * GET /api/distance/providers
 * Returns all service providers sorted by distance from logged-in customer
 */
router.get("/providers/all", customerAuth, async (req, res) => {
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

        // ✅ Only online & verified providers for the service
    const providers = await ServiceProvider.find({
      role: "provider",
      Service: Service,
      isOnline: true,
      isVerified: true
    });
    
     if (!providers.length)
      return res.status(404).json({ msg: `No providers found for ${Service}` });
    const io = req.app.get("io");
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
        // 🔔 LIVE NOTIFY PROVIDER
        if (provider.socketId) {
          io.to(provider.socketId).emit("service-alert", {
            service: Service,
            customerId: customer._id
          });
        }
        return {
          id: provider._id,
          name: provider["Full Name"],
          profilePhoto: provider["Profile Photo"] || null,
          avgRating,
          totalRatings,
          servicesDone,
          distanceInKm: distance.toFixed(2),
          experience: provider["Year of Experience"] || "N/A",
          topSkills: provider["Skills / Expertise"] || [],
          socketId: provider.socketId
        };
      })
    );
    // 3️⃣ Filter nulls (providers without location)
    const filteredProviders = providersData.filter(p => p !== null);

    // 4️⃣ Sort: highest rating, then nearest distance
    filteredProviders.sort((a, b) => {
      b.avgRating !== a.avgRating ? b.avgRating - a.avgRating : a.distanceInKm - b.distanceInKm;
    });
        // 5️⃣ Notify providers via Socket.IO
    
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