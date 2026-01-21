//models/spServiceRequest.js
const mongoose = require('mongoose');
const serviceRequestSchema = new mongoose.Schema({
  customer: { 
    type: mongoose.Schema.Types.ObjectId,
     ref: 'Customer', 
     required: true 
    },
  provider: { type: mongoose.Schema.Types.ObjectId, 
  ref: 'ServiceProvider',
   required: true
},
  service: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'in_progress','rejected', 'completed','customer-cancelled'], default: 'pending' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
       type: [Number], 
       required: true
      }
    }
  },
  {
  timestamps: true
  }
);

serviceRequestSchema.index({ location: "2dsphere" });

module.exports = mongoose.models.ServiceRequest || mongoose.model('ServiceRequest', serviceRequestSchema);
