const mongoose = require("mongoose");

const ServiceProviderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  province: { type: String, required: true },
  city: { type: String, required: true },
  wardNo: { type: String },
  shortBio: { type: String },
  serviceCategory: { type: String, required: true },
  services: [{ type: String }],
  yearsOfExperience: { type: Number, required: true },
  idType: { type: String, required: true },
  cvDocument: { type: String },
  idDocument: { type: String },
  profilePic: { type: String },
  portfolio: [{ type: String }],
  idTextOCR: { type: String }, // OCR extracted text from ID
}, { timestamps: true });

module.exports = mongoose.model("ServiceProvider", ServiceProviderSchema);
