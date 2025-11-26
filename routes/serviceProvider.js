const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const ServiceProvider = require("../models/ServiceProvider");
const auth = require("../middleware/auth");

// --- Ping route ---
router.get("/ping", (req, res) => {
  console.log("🏓 Ping endpoint called - pong from router ✅");
  res.send("pong from router ✅");
});

// --- Register ---
router.post("/register", async (req, res) => {
  try {
    console.log("📝 Register endpoint called", { email: req.body.email });
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password)
      return res.status(400).json({ error: "All fields are required" });

    const existing = await ServiceProvider.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const sp = new ServiceProvider({ name, email, phone, password: hashedPassword });
    await sp.save();
    console.log("✅ Service provider registered successfully:", email);
    res.json({ message: "Service provider registered successfully!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Login ---
router.post("/login", async (req, res) => {
  try {
    console.log("🔐 Login endpoint called", { email: req.body.email });
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const user = await ServiceProvider.findOne({ email });
    if (!user) return res.status(400).json({ error: "Email not registered" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    console.log("✅ Login successful:", email);
    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Protected route ---
router.get("/me", auth, async (req, res) => {
  try {
    const user = await ServiceProvider.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
