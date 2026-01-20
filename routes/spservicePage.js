// routes/spservicePage.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const spAuth = require("../middleware/spauth");
const ServiceProvider = require("../models/ServiceProvider");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const rating = require("../models/rating");

// ---------------------------
// Multer setup for profile updates
// ---------------------------
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ---------------------------
// Helper: Ensure folder exists
// ---------------------------
const ensureFolderExists = folderPath => {
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
};

// ---------------------------
// Helper: Save uploaded file
// ---------------------------
const saveFile = (file, folder) => {
  const uploadBaseDir = path.join(process.cwd(), "uploads");
  const dir = path.join(uploadBaseDir, folder);
  ensureFolderExists(dir);
  const fileName = Date.now() + "-" + file.originalname.replace(/\s/g, "_");
  const fullPath = path.join(dir, fileName);
  fs.writeFileSync(fullPath, file.buffer);
  return fullPath;
};

router.get("/my-details", spAuth, async (req, res) => {
  try {
    const sp = await ServiceProvider.findById(req.user.id).select(
      "fullName phone email profilePhoto yearsOfExperience rating totalRatings province district municipality wardNo service skillsExpertise shortBio address currentLocation"
    );

    if (!sp) {
      return res.status(404).json({ error: "Service provider not found" });
    }

    res.json({
      fullName: sp.fullName,
      phone: sp.phone,
      email: sp.email,
      photo: sp.profilePhoto|| "",
      experience: sp.yearsOfExperience || "",
      shortBio: sp.shortBio || "",
      rating: sp.rating || 0,
      totalRatings: sp.totalRatings || 0,
      service: sp.service,
      shortBio: sp.shortBio || "",
      address: {
        
         province: sp.homeLocation?.province || sp.province || "",
        district: sp.homeLocation?.district || sp.district || "",
        municipality: sp.homeLocation?.municipality || sp.municipality || "",
        ward: sp.homeLocation?.ward || sp.wardNo || ""
      },
      skills: sp.skillsExpertise.map(skill => ({
        name: skill.name,
        price: skill.price ?? null  // optional, show null if not provided
      })),
      currentLocation: {
        type: sp.currentLocation.type,
        coordinates: sp.currentLocation.coordinates
      }
    });

  } catch (err) {
    console.error("Error fetching SP details:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// ---------------------------
// Profile update (photo, phone, CV, extra certs, portfolio, skills)
// ---------------------------
router.patch(
  "/update-profile",
  spAuth,
  upload.fields([
    { name: "Profile Photo", maxCount: 1 },
    { name: "Upload CV", maxCount: 1 },
    { name: "Extra Certificate", maxCount: 5 },
    { name: "Portfolio", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const sp = await ServiceProvider.findById(req.user.id);
      if (!sp) return res.status(404).json({ error: "Service provider not found" });

      const files = req.files || {};
      const body = req.body;
          // Helper: Delete old file if exists
      const deleteFile = (filePath) => {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("sp: Deleted old file:", filePath);
        }
      };


      // Update phone
      if (body.Phone) {
        const phoneRegex = /^\+977\d{10}$/;
        if (!phoneRegex.test(body.Phone))
          return res.status(400).json({ error: "Phone number must be in Nepal format +977XXXXXXXXXX" });
        sp.phone = body.Phone;
      }

      // Update skills/expertise
      if (body["Skills / Expertise"]) {
        const skillsRaw = body["Skills / Expertise"];
        const skills = typeof skillsRaw === "string"
          ? (skillsRaw.startsWith("[") ? JSON.parse(skillsRaw) : skillsRaw.split(",").map(s => s.trim()))
          : skillsRaw;
        if (!Array.isArray(skills) || skills.length === 0)
          return res.status(400).json({ error: "Skills/Expertise must be non-empty array" });
        sp["Skills / Expertise"] = skills;
      }

      // Update files
      if (files["Profile Photo"]?.[0]) sp["Profile Photo"] = saveFile(files["Profile Photo"][0], "profile");
      if (files["Upload CV"]?.[0]) sp.cvDocument = saveFile(files["Upload CV"][0], "cv");
      if (files["Extra Certificate"]?.length > 0)
        sp["Extra Certificate"] = files["Extra Certificate"].map(f => saveFile(f, "Extra Certificate"));
      if (files["Portfolio"]?.length > 0) sp.Portfolio = files["Portfolio"].map(f => saveFile(f, "Portfolio"));

      await sp.save();
      res.json({ message: "Profile updated successfully", user: sp });
    } catch (err) {
      console.error("Service Page: Profile update error", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  }
);

module.exports = router;
