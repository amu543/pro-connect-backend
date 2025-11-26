const mongoose = require("mongoose");

console.log("[ServiceProvider Model] Mongoose version:", mongoose.version);

const ServiceProviderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true }
});

const ServiceProvider = mongoose.model("ServiceProvider", ServiceProviderSchema);
console.log("[ServiceProvider Model] Model created, typeof:", typeof ServiceProvider);
console.log("[ServiceProvider Model] Has findOne?", typeof ServiceProvider.findOne);

module.exports = ServiceProvider;
