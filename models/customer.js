// models/customer.js
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true},
    email: {type: String,required: true,unique: true,lowercase: true},
    phone: {type: String,required: true },
    password: {type: String,required: true },
    profilePhoto: {type: String,default: null },
    role: { type: String, default: "customer" },
    // GEOLOCATION
    location: {
      type: { type: String,enum: ["Point"],default: "Point" },
      coordinates: { type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },

    isOnline: {
      type: Boolean,
      default: false
    },

    socketId: {
      type: String,
      default: null
    },

    otp: {
      type: String,
 default: null
    },
  otpExpires: {
  type: Date,
  default: null
},
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// 2dsphere index for geospatial queries
customerSchema.index({ location: "2dsphere" });

module.exports = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
