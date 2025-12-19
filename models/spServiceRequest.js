//models/spServiceRequest.js
const mongoose = require('mongoose');
const serviceRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceProviderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
  service: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed'], default: 'pending' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  createdAt: { type: Date, default: Date.now }
});

serviceRequestSchema.index({ location: "2dsphere" });

module.exports = mongoose.models.ServiceRequest || mongoose.model('ServiceRequest', serviceRequestSchema);
