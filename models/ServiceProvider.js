//models/ServiceProvider.js
// ServiceProvider Model
const mongoose = require("mongoose");
const ServiceProviderSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
    sex: {type: String,enum: ["Male", "Female", "Other"],required: true },
  password: { type: String, required: true },
  profilePhoto: { type: String, required: true },
  service: { type: String, required: true },
  yearsOfExperience: { type: String, required: true },
  skillsExpertise: [
    { 
    name:{type: String, required: true },
    price: { type: Number, required: false, default: null }
  }],
  shortBio: { type: String },
  province: { type: String, required: true },
  district: { type: String, required: true },
  municipality: { type: String, required: true },
  wardNo: { type: String, required: true }, 
   role: { type: String, default: "provider" }, 
  idType: { type: String, required: true },
  idDocument: { type: String, required: true },
  cvDocument: { type: String, required: true },
  portfolioFiles: { type: [String] }, // multiple portfolio files
  extraCertificates: { type: [String] }, // multiple extra certificates
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
