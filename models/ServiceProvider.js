//models/ServiceProvider.js
const mongoose = require("mongoose");
const ServiceProviderSchema = new mongoose.Schema({
  "Full Name": { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
    Sex: {type: String,enum: ["Male", "Female", "Other"],required: true },
  password: { type: String, required: true },
  "Profile Photo": { type: String, required: true },
  Service: { type: String, required: true },
  "Year of Experience": { type: String, required: true },
  "Skills / Expertise": { type: [String], required: true },
  "Short Bio": { type: String },
  Province: { type: String, required: true },
  District: { type: String, required: true },
  Municipality: { type: String, required: true },
  "Ward No": { type: String, required: true }, 
   role: { type: String, default: "provider" }, 
  "ID type": { type: String, required: true },
  idDocument: { type: String, required: true },
  cvDocument: { type: String, required: true },
  Portfolio: { type: [String] }, // multiple portfolio files
  "Extra Certificate": { type: [String] }, // multiple extra certificates
  idTextOCR: { type: String }, // OCR text from ID
   idVerified: { type: Boolean, default: false }, // default false
  idVerificationDetails: { type: Object, default: {} }, // details filled later
   cvVerificationDetails: {
    nameMatched: { type: Boolean, default: false },
    serviceMatched: { type: Boolean, default: false },
    skillsMatched: { type: [String], default: [] },
    experienceMatched: { type: Boolean, default: false },
    extractedYears: { type: Number, default: null },
    error: { type: String, default: null }
  },
  isOnline: {
      type: Boolean,
      default: false
    },
  isVerified: {
  type: Boolean,
  default: false,
}, 
   ratings: { avgRating: { type: Number, default: 0 }, totalRatings: { type: Number, default: 0 } },
  homeLocation: {
    province: String,
    district: String,
    municipality: String,
    ward: String
  },
  currentLocation: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }
  },
  otp: { type: String },
  otpExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
 
}, { timestamps: true });
   ServiceProviderSchema.index({ currentLocation: "2dsphere" });
module.exports = mongoose.model("ServiceProvider", ServiceProviderSchema);
