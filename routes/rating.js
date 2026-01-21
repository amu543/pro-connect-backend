//routes/rating.js
const express = require('express'); 
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const Rating = require('../models/rating'); // lowercase
const ServiceProvider = require('../models/ServiceProvider'); // for updating avg rating
const customerAuth = require('../middleware/customerAuth');
const ServiceRequest = require('../models/spServiceRequest'); // to verify service completion
// ----------------------------
// Add a rating & review
// ----------------------------

// ---
router.post("/add", customerAuth, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { serviceProviderId, rating, review } = req.body;

    // 1️⃣ Only customers can rate (redundant check)
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Access denied: Only customers can rate providers" });
    }

    // 2️⃣ Check if the customer already rated this provider
    const existing = await Rating.findOne({ serviceProviderId, customerId });
    if (existing) {
      return res.status(400).json({ message: "You have already rated this provider" });
    }

    // 3️⃣ Check if there is a completed or customer-cancelled service
    const service = await ServiceRequest.findOne({
      customer: customerId,
      provider: serviceProviderId,
      status: { $in: ["completed", "customer-cancelled"] }, // ✅ allow rating
    });

    if (!service) {
      return res.status(400).json({
        message: "You can only rate after the service is completed or cancelled by you",
      });
    }

    // 4️⃣ Save the rating
    const newRating = new Rating({ serviceProviderId, customerId, rating, review });
    await newRating.save();

    // 5️⃣ Update ServiceProvider avgRating & totalRatings
    const allRatings = await Rating.find({ serviceProviderId });
    const totalRatings = allRatings.length;
    const avgRating =
      totalRatings > 0 ? allRatings.reduce((acc, r) => acc + r.rating, 0) / totalRatings : 0;

    await ServiceProvider.findByIdAndUpdate(serviceProviderId, {
      "ratings.avgRating": avgRating.toFixed(1),
      "ratings.totalRatings": totalRatings,
    });

    res.status(201).json({ message: "Rating submitted successfully", rating: newRating });
  } catch (error) {
    console.error("Error in /rating/add:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
// Get all reviews for a service provider
// ----------------------------
router.get('/reviews/:serviceProviderId', async (req, res) => {
  try {
    const { serviceProviderId } = req.params;
    const reviews = await Rating.find({ serviceProviderId })
      .populate('customerId', 'fullName') // optional: get customer name
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// ----------------------------
// Get average rating for a service provider
// ----------------------------
router.get('/average/:serviceProviderId', async (req, res) => {
  try {
    const { serviceProviderId } = req.params;
    
    const result = await Rating.aggregate([
      { $match: { serviceProviderId: new mongoose.Types.ObjectId(serviceProviderId) } },
      { $group: { _id: '$serviceProviderId', avgRating: { $avg: '$rating' }, totalRatings: { $sum: 1 } } }
    ]);

    if (result.length === 0) {
      return res.json({ avgRating: 0, totalRatings: 0 });
    }
    res.json({ avgRating: result[0].avgRating.toFixed(1), totalRatings: result[0].totalRatings });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;