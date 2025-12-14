const mongoose = require("mongoose");

const ServiceProviderSchema = new mongoose.Schema({
  "Full Name": { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  "Profile Photo": { type: String, required: true },
  Service: { type: String, required: true },
  "Year of Experience": { type: String, required: true },
  "Skills / Expertise": { type: [String], required: true },
  "Short Bio (optional)": { type: String },
  Province: { type: String, required: true },
  District: { type: String, required: true },
  Municipality: { type: String, required: true },
  "Ward No": { type: String, required: true }, 
  "ID type": { type: String, required: true },
  idDocument: { type: String, required: true },
  cvDocument: { type: String, required: true },
  Portfolio: { type: [String] }, // multiple portfolio files
  ExtraCertificate: { type: [String] }, // multiple extra certificates
  idTextOCR: { type: String }, // OCR text from ID
   faceMatchPercent: { type: Number },
  cvVerified: { type: Boolean, default: false },
  cvVerificationDetails: { type: [String], default: [] },
  otp: { type: String },
  otpExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
 
}, { timestamps: true });

module.exports = mongoose.model("ServiceProvider", ServiceProviderSchema);
