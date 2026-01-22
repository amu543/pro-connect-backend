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
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const map = {
      profilePhoto: "uploads/profile",
      cvDocument: "uploads/cv",
      extraCertificates: "uploads/certificates",
      portfolio: "uploads/portfolio"
    };

    const folder = map[file.fieldname] || "uploads/others";
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "-" + cleanName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

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
  return file.path.replace(/\\/g, "/");
};
//get my profile details
router.get("/my-details", spAuth, async (req, res) => {
  try {
    const sp = await ServiceProvider.findById(req.user.id).select(
      "fullName phone email profilePhoto yearsOfExperience rating totalRatings province district municipality wardNo service skillsExpertise shortBio address currentLocation"
    );

    if (!sp) {
      return res.status(404).json({ error: "Service provider not found" });
    }
  console.log("PROFILE PHOTO PATH FROM DB:", sp.profilePhoto);
    res.json({
      fullName: sp.fullName,
      phone: sp.phone,
      email: sp.email,
       photo: sp.profilePhoto ? `/${sp.profilePhoto}` : "",
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
    { name: "profilePhoto", maxCount: 1 },
    { name: "cvDocument", maxCount: 1 },
    { name: "extraCertificates", maxCount: 5 },
    { name: "portfolio", maxCount: 5 },
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
     if (files.profilePhoto?.[0]) {
        sp.profilePhoto = saveFile(files.profilePhoto[0]);
      }

      if (files.cvDocument?.[0]) {
        sp.cvDocument = saveFile(files.cvDocument[0]);
      }

      if (files.extraCertificates?.length) {
        sp.extraCertificates = files.extraCertificates.map(saveFile);
      }

      if (files.portfolio?.length) {
        sp.portfolio = files.portfolio.map(saveFile);
      }
      await sp.save();
      res.json({ message: "Profile updated successfully", user: sp });
    } catch (err) {
      console.error("Service Page: Profile update error", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  }
);

module.exports = router;
