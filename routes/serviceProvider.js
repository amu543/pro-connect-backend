const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ServiceProvider = require("../models/ServiceProvider");
const auth = require("../middleware/auth");

// Helper to ensure folder exists
const ensureFolderExists = (folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      console.log(`🔨 Creating folder: ${folderPath}`);
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`✅ Folder created: ${folderPath}`);
    } else {
      console.log(`✅ Folder already exists: ${folderPath}`);
    }
  } catch (err) {
    console.error(`❌ Error creating folder ${folderPath}:`, err.message);
    throw err;
  }
};

// ---------------------------
// Multer configuration with file size limits
// ---------------------------
const storage = multer.memoryStorage(); // Files stored in memory, not on disk

const fileFilter = (req, file, cb) => {
  console.log(`🔍 Validating file: ${file.fieldname} (${file.mimetype}, ${file.size} bytes)`);
  
  // CV validation: PDF only, max 5MB
  if (file.fieldname === "cv") {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("CV must be a PDF file"), false);
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      return cb(new Error("CV file size must be less than 5MB"), false);
    }
    console.log("✅ CV file valid");
    return cb(null, true);
  }
  
  // ID validation: Image only, max 3MB
  if (file.fieldname === "id") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("ID document must be an image file"), false);
    }
    // Allow only specific image types
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("ID document must be JPEG or PNG format"), false);
    }
    if (file.size > 3 * 1024 * 1024) { // 3MB
      return cb(new Error("ID document size must be less than 3MB"), false);
    }
    console.log("✅ ID file valid");
    return cb(null, true);
  }
  
  // Profile picture validation: Image only, max 2MB
  if (file.fieldname === "profile") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Profile picture must be an image file"), false);
    }
    // Allow only specific image types
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Profile picture must be JPEG or PNG format"), false);
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
      return cb(new Error("Profile picture size must be less than 2MB"), false);
    }
    console.log("✅ Profile picture file valid");
    return cb(null, true);
  }
  
  cb(new Error(`Unknown file field: ${file.fieldname}`), false);
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB global limit
    files: 3 // Max 3 files per request
  }
});

// ---------------------------
// Ping route
// ---------------------------
router.get("/ping", (req, res) => {
  res.send("pong ✅");
  console.log("Ping received");
});

// ---------------------------
// Register route
// ---------------------------
router.post(
  "/register",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "id", maxCount: 1 },
    { name: "profile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("📝 Register endpoint called");
      console.log("📦 req.body:", JSON.stringify(req.body, null, 2));
      console.log("📁 req.files keys:", Object.keys(req.files || {}));
      
      const { name, email, phone, password, province, city, wardNo, shortBio, services, yearsOfExperience } = req.body;
      console.log("🔍 Extracted values:", { name, email, phone, password, province, city, wardNo, shortBio, yearsOfExperience, services });
      
      // Check required fields
      if (!name || !email || !phone || !password) {
        console.log("❌ Missing required fields:", { name, email, phone, password });
        return res.status(400).json({ error: "Name, email, phone, and password are required" });
      }

      // Check location fields
      if (!province || !city || !wardNo) {
        console.log("❌ Missing location fields:", { province, city, wardNo });
        return res.status(400).json({ error: "Province, city, and ward number are required" });
      }

      // Check required profile fields (shortBio is optional)
      if (!services || !yearsOfExperience) {
        console.log("❌ Missing profile fields:", { services, yearsOfExperience });
        return res.status(400).json({ error: "Services and years of experience are required" });
      }

      // Validate yearsOfExperience is a number
      const experience = Number(yearsOfExperience);
      if (isNaN(experience) || experience < 0) {
        console.log("❌ Invalid years of experience:", yearsOfExperience);
        return res.status(400).json({ error: "Years of experience must be a valid number >= 0" });
      }

      // Parse services if it's a string (from form-data it comes as JSON string)
      let parsedServices = services;
      if (typeof services === 'string') {
        try {
          parsedServices = JSON.parse(services);
        } catch (e) {
          // If not valid JSON, treat as single service
          parsedServices = [services];
        }
      }

      if (!Array.isArray(parsedServices) || parsedServices.length === 0) {
        console.log("❌ Services must be a non-empty array");
        return res.status(400).json({ error: "At least one service is required" });
      }

      console.log("✅ All profile fields valid:", { shortBio: shortBio || "N/A", services: parsedServices, yearsOfExperience: experience });

      // Check if all files are uploaded
      const files = req.files || {};
      if (!files.cv || !files.id || !files.profile) {
        console.log("❌ Missing required files. cv:", !!files.cv, "id:", !!files.id, "profile:", !!files.profile);
        return res.status(400).json({ 
          error: "CV, ID document, and profile picture are required",
          missing: {
            cv: !files.cv,
            id: !files.id,
            profile: !files.profile
          }
        });
      }

      const existing = await ServiceProvider.findOne({ email });
      if (existing) {
        console.log("❌ Email already registered:", email);
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Save files from memory to disk
      // Use absolute path from process.cwd() to ensure correct directory
      const uploadBaseDir = path.join(process.cwd(), 'uploads');
      let cvPath = '';
      let idPath = '';
      let profilePath = '';

      if (files.cv && files.cv[0]) {
        const cvDir = path.join(uploadBaseDir, 'cv');
        console.log(`📁 CV directory: ${cvDir}`);
        ensureFolderExists(cvDir);
        cvPath = path.join(cvDir, Date.now() + '-' + files.cv[0].originalname);
        console.log(`📝 Writing CV to: ${cvPath}`);
        fs.writeFileSync(cvPath, files.cv[0].buffer);
        console.log("✅ CV saved:", cvPath);
      }

      if (files.id && files.id[0]) {
        const idDir = path.join(uploadBaseDir, 'id');
        console.log(`📁 ID directory: ${idDir}`);
        ensureFolderExists(idDir);
        idPath = path.join(idDir, Date.now() + '-' + files.id[0].originalname);
        console.log(`📝 Writing ID to: ${idPath}`);
        fs.writeFileSync(idPath, files.id[0].buffer);
        console.log("✅ ID saved:", idPath);
      }

      if (files.profile && files.profile[0]) {
        const profileDir = path.join(uploadBaseDir, 'profile');
        console.log(`📁 Profile directory: ${profileDir}`);
        ensureFolderExists(profileDir);
        profilePath = path.join(profileDir, Date.now() + '-' + files.profile[0].originalname);
        console.log(`📝 Writing profile to: ${profilePath}`);
        fs.writeFileSync(profilePath, files.profile[0].buffer);
        console.log("✅ Profile saved:", profilePath);
      }

      const sp = new ServiceProvider({
        name,
        email,
        phone,
        password: hashedPassword,
        province,
        city,
        wardNo,
        shortBio,
        services: parsedServices,
        yearsOfExperience: experience,
        cvDocument: cvPath,
        idDocument: idPath,
        profilePic: profilePath,
      });

      console.log("💾 Saving service provider:", { name, email, phone, province, city, wardNo, shortBio, services: parsedServices, yearsOfExperience: experience });
      await sp.save();
      console.log("✅ Service provider registered successfully:", email);
      res.json({ message: "Service provider registered successfully!" });
    } catch (err) {
      console.error("❌ Register error:", err.message);
      console.error("Stack:", err.stack);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  }
);

// ---------------------------
// Login route
// ---------------------------
router.post("/login", async (req, res) => {
  try {
    console.log("📝 Login endpoint called");
    console.log("📦 req.body:", JSON.stringify(req.body, null, 2));
    
    const { email, password } = req.body;
    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({ error: "Email and password are required" });
    }

    console.log("🔍 Finding user with email:", email);
    const user = await ServiceProvider.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(400).json({ error: "Email not registered" });
    }
    console.log("✅ User found:", { id: user._id, name: user.name, email: user.email });

    console.log("🔑 Comparing password...");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Invalid password for:", email);
      return res.status(400).json({ error: "Invalid password" });
    }
    console.log("✅ Password matched");

    console.log("🎫 Generating JWT token...");
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    console.log("✅ JWT token generated successfully");
    console.log("🔐 Token:", token);
    
    res.json({ message: "Login successful", token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ---------------------------
// Protected route - Get user profile
// ---------------------------
router.get("/me", auth, async (req, res) => {
  try {
    console.log("📋 /me endpoint called by user:", req.user.id);
    const user = await ServiceProvider.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    console.log("✅ User profile retrieved:", user.email);
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// File download endpoint (Protected)
// ---------------------------
router.get("/file/:userId/:fileType", auth, async (req, res) => {
  try {
    const { userId, fileType } = req.params;
    
    console.log(`📥 File download requested: user=${userId}, type=${fileType}`);
    
    // Only allow users to download their own files or admin can download any
    if (req.user.id !== userId) {
      console.log(`❌ Access denied: user ${req.user.id} tried to access ${userId}'s files`);
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Find user and get file path
    const user = await ServiceProvider.findById(userId);
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return res.status(404).json({ error: "User not found" });
    }
    
    let filePath = null;
    switch(fileType) {
      case "cv":
        filePath = user.cvDocument;
        break;
      case "id":
        filePath = user.idDocument;
        break;
      case "profile":
        filePath = user.profilePic;
        break;
      default:
        return res.status(400).json({ error: "Invalid file type. Use: cv, id, or profile" });
    }
    
    if (!filePath) {
      console.log(`❌ File not found: ${fileType} for user ${userId}`);
      return res.status(404).json({ error: `${fileType} file not found` });
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File does not exist on disk: ${filePath}`);
      return res.status(404).json({ error: "File not found on server" });
    }
    
    console.log(`✅ Sending file: ${filePath}`);
    res.download(filePath);
  } catch (err) {
    console.error(`❌ File download error:`, err.message);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
