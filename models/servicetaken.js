const mongoose = require("mongoose");

const serviceTakenSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    service: {
      type: String,
      required: true
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },

    completedBy: {
      type: String,
      enum: ["customer", "provider"],
      required: true
    },

    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);
// Create 2dsphere index for geospatial queries
serviceTakenSchema.index({ location: "2dsphere" });
module.exports = mongoose.model("ServiceTaken", serviceTakenSchema);