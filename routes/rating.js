const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Rating = require('../models/rating');

// Add a rating & review
router.post('/add', async (req, res) => {
  try {
    const { serviceProviderId, customerId, rating, review } = req.body;

    // Optional: Check if this customer already rated this provider
    const existing = await Rating.findOne({ serviceProviderId, customerId });
    if (existing) {
      return res.status(400).json({ message: "You have already rated this provider" });
    }

    const newRating = new Rating({ serviceProviderId, customerId, rating, review });
    await newRating.save();

    res.status(201).json({ message: "Rating submitted successfully", rating: newRating });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Get all reviews for a service provider
router.get('/reviews/:serviceProviderId', async (req, res) => {
  try {
    const { serviceProviderId } = req.params;
    const reviews = await Rating.find({ serviceProviderId })
      .populate('customerId', 'name') // optional: get customer name
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Get average rating for a service provider
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
module.exports.default = router; // supports some interop cases