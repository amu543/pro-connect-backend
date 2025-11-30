const mongoose = require("mongoose");

const ServiceProviderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },

    // Location fields
    province: { type: String, required: true },
    city: { type: String, required: true },
    wardNo: { type: String, required: true },

    // Profile fields
    shortBio: { type: String },  // Optional
    services: { type: [String], required: true }, // Array of services
    yearsOfExperience: { type: Number, required: true, min: 0 },

    // File uploads
    profilePic: { type: String, required: true },
    idDocument: { type: String, required: true },
    cvDocument: { type: String, required: true },
});

module.exports = mongoose.model("ServiceProvider", ServiceProviderSchema);
