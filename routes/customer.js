// routes/customer.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const Customer = require("../models/customer");
const customerAuth = require("../middleware/customerAuth");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
       user: process.env.EMAIL_SERVICE_USER,
    pass: process.env.EMAIL_SERVICE_PASS

  }
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendEmailOTP = async (email, otp) => {
  await transporter.sendMail({
    from: process.env.EMAIL_SERVICE_USER,
    to: email,
    subject: "Pro-Connect Email Verification",
    html: `<h2>Your OTP is: <b>${otp}</b></h2><p>Valid for 5 minutes</p>`
  });
};
//Customer Registration

router.post("/register", async (req, res) => {
  try {
    const {
      ["Full Name"]: fullName,
      Email: email,
      Phone: phone,
      Password: password,
      ["Confirm Password"]: confirmPassword,
      ["Profile Photo"]: profilePhoto
    } = req.body;

    if (!fullName || !email || !phone || !password || !confirmPassword)
      return res.status(400).json({ msg: "All fields are required" });
    if (password !== confirmPassword)
      return res.status(400).json({ msg: "Passwords do not match" });

    const phoneRegex = /^\+977\d{10}$/;
    if (!phoneRegex.test(phone))
      return res.status(400).json({ msg: "Phone must be in Nepal format +977XXXXXXXXXX" });

    const existingUser = await Customer.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already registered" });

    const otp = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);

    const newCustomer = new Customer({
      fullName,
      email:email.toLowerCase(),
      phone,
      password: hashedPassword,
      profilePhoto,
      role: "customer",
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000),
      isVerified: false
    });

    await newCustomer.save();
    await sendEmailOTP(email, otp);
    res.status(201).json({ msg: "OTP sent to email", email });
  } catch (err) {
    console.error("Customer register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { Email: email, OTP: otp } = req.body;
    if (!email || !otp) return res.status(400).json({ msg: "Email and OTP required" });


    const user = await Customer.findOne({ email, role: "customer" });
    if (!user) return res.status(404).json({ msg: "Customer not found" });
    if (user.isVerified) return res.status(400).json({ msg: "Account already verified" });
    if (user.otp !== otp) return res.status(400).json({ msg: "Invalid OTP" });
    if (user.otpExpires && user.otpExpires < new Date()) return res.status(400).json({ msg: "OTP expired" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();
    res.json({ msg: "Email verified successfully" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// Customer Login
router.post("/login", async (req, res) => {
  try {
    const { Email: email, Password: password, latitude, longitude } = req.body;
    if (!email || !password || typeof latitude !== "number" || typeof longitude !== "number")
      return res.status(400).json({ msg: "Email, password and GPS location required" });
    const user = await Customer.findOne({ email, role: "customer" });
    if (!user) return res.status(400).json({ msg: "Customer not found" });
    if (!user.isVerified) return res.status(403).json({ msg: "Email not verified" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Incorrect password" });

    user.location = { type: "Point", coordinates: [longitude, latitude] };
    user.isOnline = true;
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role || "customer" }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      msg: "Customer login successful",
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role || "customer" }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// Customer Logout
router.post("/logout", customerAuth, async (req, res) => {
  try {
    if (req.user.role !== "customer") return res.status(403).json({ msg: "Unauthorized role" });
    const user = await Customer.findById(req.user.id);
    if (user) {
      user.isOnline = false;
      user.socketId = null;
      await user.save();
    }
    res.json({ success: true, role: "Customer", msg: "Customer logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// Get Customer Profile
router.get("/me", customerAuth, async (req, res) => {
  try {
    const user = await Customer.findById(req.user.id).select("-password -otp -otpExpires");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// Edit Customer Profile
router.put("/edit-profile", customerAuth, async (req, res) => {
  try {
    if (req.user.role !== "customer") return res.status(403).json({ msg: "Access denied" });
    const { phone, profilePhoto,location } = req.body;
    const update = {};
    if (phone) update.phone = phone;
    if (profilePhoto) update.profilePhoto = profilePhoto;
     // ✅ GeoJSON location handling
    if (
      location &&
      typeof location.latitude === "number" &&
      typeof location.longitude === "number"
    ) {
      update.location = {
        type: "Point",
        coordinates: [location.longitude, location.latitude]
      };
    }
    const updatedUser = await Customer.findByIdAndUpdate(req.user.id, update, { new: true }).select("-password -otp");
    res.json({ msg: "Profile updated successfully", user: updatedUser });
  } catch (err) {
    console.error("Edit profile error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { Email: email } = req.body;
    const user = await Customer.findOne({ email, role: "customer" });
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.isVerified) return res.status(400).json({ msg: "Account already verified" });
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
    await sendEmailOTP(email, otp);
    res.json({ msg: "OTP resent successfully" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;