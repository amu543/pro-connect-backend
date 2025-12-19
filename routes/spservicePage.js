// routes/spservicePage.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const spAuth = require("../middleware/spauth");
const ServiceProvider = require("../models/ServiceProvider");
const ServiceRequest = require("../models/spServiceRequest");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

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

// ---------------------------
// Helper: Haversine distance in KM
// ---------------------------
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------
// Fetch incoming requests (pending) with distance
// ---------------------------
router.get("/incoming-requests", spAuth, async (req, res) => {
  try {
    const sp = await ServiceProvider.findById(req.user.id);
    if (!sp) return res.status(404).json({ error: "Service provider not found" });

    if (!sp.currentLocation?.coordinates || sp.currentLocation.coordinates.length !== 2) {
      return res.status(400).json({ error: "GPS location not enabled" });
    }

    const requests = await ServiceRequest.find({
      serviceProviderId: req.user.id,
      status: "pending",
    }).populate("customerId", "name");

    const response = requests.map(reqItem => {
      const [lon, lat] = sp.currentLocation.coordinates;
      const [custLon, custLat] = reqItem.location.coordinates || [0, 0];
      return {
        requestId: reqItem._id,
        service: reqItem.service,
        customerName: reqItem.customerId?.name || "Unknown",
        requestedDate: reqItem.createdAt.toISOString().split("T")[0],
        distanceKm: parseFloat(getDistanceKm(lat, lon, custLat, custLon).toFixed(1)),
        status: reqItem.status,
      };
    });

    res.json(response);
  } catch (err) {
    console.error("Service Page: Error fetching incoming requests", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ---------------------------
// Fetch accepted requests with full customer info + distance
// ---------------------------
router.get("/accepted-requests", spAuth, async (req, res) => {
  try {
    const sp = await ServiceProvider.findById(req.user.id);
    if (!sp) return res.status(404).json({ error: "Service provider not found" });

    const requests = await ServiceRequest.find({
      serviceProviderId: req.user.id,
      status: "accepted",
    }).populate("customerId", "name phone location");

    const response = requests.map(reqItem => {
      const [lon, lat] = sp.currentLocation.coordinates;
      const [custLon, custLat] = reqItem.location.coordinates || [0, 0];
      return {
        requestId: reqItem._id,
        service: reqItem.service,
        customerName: reqItem.customerId?.name || "Unknown",
        customerPhone: reqItem.customerId?.phone || "",
        customerLocation: reqItem.customerId?.location || null,
        distanceKm: parseFloat(getDistanceKm(lat, lon, custLat, custLon).toFixed(1)),
        requestedDate: reqItem.createdAt.toISOString().split("T")[0],
        status: reqItem.status,
      };
    });

    res.json(response);
  } catch (err) {
    console.error("Service Page: Error fetching accepted requests", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ---------------------------
// Mark request as completed
// ---------------------------
router.post("/complete-request/:requestId", spAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await ServiceRequest.findOne({ _id: requestId, serviceProviderId: req.user.id });
    if (!request) return res.status(404).json({ error: "Request not found" });

    request.status = "completed";
    request.completedAt = new Date();
    await request.save();

    res.json({ message: "Request marked as completed", request });
  } catch (err) {
    console.error("Service Page: Error completing request", err);
    res.status(500).json({ error: "Server error", details: err.message });
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
