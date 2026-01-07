// routes/serviceProvider.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Tesseract = require("tesseract.js");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const mammoth = require("mammoth");
const ServiceProvider = require("../models/ServiceProvider");
const ServiceRequest = require("../models/spServiceRequest");
const Rating = require("../models/sprating");
const spAuth = require("../middleware/spauth");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { performOCR } = require("../ocr");

// OTP HELPERS
// ===================================================
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailOTP(email, otp) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_SERVICE_USER,
      pass: process.env.EMAIL_SERVICE_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_SERVICE_USER,
    to: email,
    subject: "Pro Connect – Email Verification",
    text: `Your OTP is ${otp}. Valid for 5 minutes.`,
  });
}
// Helper: Ensure folder exists
// ---------------------------
const ensureFolderExists = folderPath => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log("sp: Folder created:", folderPath);
  }
};

// ---------------------------
// Multer config
// ---------------------------
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowed = {
    "Profile Photo": ["image/jpeg", "image/png", "image/jpg"],
    "Upload ID": ["image/jpeg", "image/png", "image/jpg"],
    "Upload CV": ["application/pdf"],
    Portfolio: ["image/jpeg", "image/png", "image/jpg"],
    "Extra Certificate": ["image/jpeg", "image/png", "image/jpg"],
  };
  if (!allowed[file.fieldname]) return cb(new Error("sp: Unknown file field"), false);
  if (!allowed[file.fieldname].includes(file.mimetype))
    return cb(new Error(`${file.fieldname} must be ${allowed[file.fieldname].join("/")}`), false);
  cb(null, true);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });


// Update provider rating after customer submits
async function updateProviderRating(providerId) {
  console.log("sp: Updating ratings for provider", providerId);
  const result = await Rating.aggregate([
    { $match: { serviceProviderId: providerId } },
    { $group: { _id: "$serviceProviderId", avgRating: { $avg: "$rating" }, totalRatings: { $sum: 1 } } }
  ]);

  if (result.length > 0) {
    await ServiceProvider.findByIdAndUpdate(providerId, {
      ratings: {
        avgRating: parseFloat(result[0].avgRating.toFixed(1)),
        totalRatings: result[0].totalRatings
      }
    });
    console.log("sp: Ratings updated", result[0]);
  } else {
    await ServiceProvider.findByIdAndUpdate(providerId, {
      ratings: { avgRating: 0, totalRatings: 0 }
    });
    console.log("sp: Ratings reset to 0");
  }
}


// ---------------------------
// Get incoming requests for SP
// ---------------------------
router.get("/sp-requests", spAuth, async (req, res) => {
  try {
    console.log("sp: Fetching incoming service requests for", req.user.id);
    const requests = await ServiceRequest.find({ serviceProviderId: req.user.id, status: 'pending' })
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 });

    console.log("sp: Incoming requests fetched:", requests.length);
    res.json(requests);
  } catch (err) {
    console.error("sp: Error fetching requests:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ---------------------------
// Get accepted requests for SP
// ---------------------------
router.get("/sp-requests/accepted", spAuth, async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      serviceProviderId: req.user.id,
      status: "accepted"
    })
      .populate("customerId", "name phone")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// Get completed requests for SP
// ---------------------------
router.get("/sp-requests/completed", spAuth, async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      serviceProviderId: req.user.id,
      status: "completed"
    })
      .populate("customerId", "name phone")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// Accept a request
// ---------------------------
router.post("/sp-request-accept/:requestId", spAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log("sp: Accepting request", requestId);

    const request = await ServiceRequest.findOne({ _id: requestId, serviceProviderId: req.user.id });
    if (!request) return res.status(404).json({ error: "Request not found" });

    request.status = "accepted";
    await request.save();
    console.log("sp: Request accepted", requestId);
       // 🔔 NOTIFY CUSTOMER
    const io = req.app.get("io");
    io.to(request.customerId.toString()).emit("requestAccepted", {
      requestId: request._id,
      spId: req.user.id,
      status: "accepted",
      message: "Service provider accepted your request"
    });

    res.json({ message: "Request accepted", request });
  } catch (err) {
    console.error("sp: Error accepting request:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ---------------------------
// Reject a request
// ---------------------------
router.post("/sp-request-reject/:requestId", spAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log("sp: Rejecting request", requestId);

    const request = await ServiceRequest.findOne({ _id: requestId, serviceProviderId: req.user.id });
    if (!request) return res.status(404).json({ error: "Request not found" });

    request.status = "rejected";
    await request.save();
    console.log("sp: Request rejected", requestId);
     // 🔔 NOTIFY CUSTOMER
    const io = req.app.get("io");
    io.to(request.customerId.toString()).emit("requestRejected", {
      requestId: request._id,
      spId: req.user.id,
      status: "rejected",
      message: "Service provider rejected your request"
    });

    res.json({ message: "Request rejected", request });
  } catch (err) {
    console.error("sp: Error rejecting request:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ---------------------------
// Mark request as completed
// ---------------------------
router.post("/sp-request-complete/:requestId", spAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log("sp: Completing request", requestId);

    const request = await ServiceRequest.findOne({ _id: requestId, serviceProviderId: req.user.id });
    if (!request) return res.status(404).json({ error: "Request not found" });

    request.status = "completed";
    await request.save();
    console.log("sp: Request completed", requestId);
       // 🔔 NOTIFY CUSTOMER
    const io = req.app.get("io");
    io.to(request.customerId.toString()).emit("requestCompleted", {
      requestId: request._id,
      spId: req.user.id,
      status: "completed",
      message: "Your service has been completed"
    });

    // Optionally, recalc ratings if customer already rated
    await updateProviderRating(req.user.id);

    res.json({ message: "Request marked as completed", request });
  } catch (err) {
    console.error("sp: Error completing request:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});
// ---------------------------
// Ping
// ---------------------------
router.get("/sp-ping", (req, res) => {
  console.log("sp: Ping received");
  res.send("sp: pong ✅");
});
// Helper: Case-insensitive CV verification using OCR
// ---------------------------
async function verifyCV(cvPath, fullName, service, skills, yearsOfExperience) {
  let cvText = "";
  let cvVerified = true;
  const cvVerificationDetails = {
    nameMatched: false,
    serviceMatched: false,
    skillsMatched: [],
    experienceMatched: false,
    extractedYears: null};

    const ext = path.extname(cvPath).toLowerCase();
     try{
       if (ext === ".pdf") {
      // ✅ Use legacy build for Node.js
      const data = new Uint8Array(fs.readFileSync(cvPath));
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      let textContent = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textContent += content.items.map(item => item.str).join(" ") + "\n";
      }
      cvText = textContent.toLowerCase();

    } else if (ext === ".txt") {
      cvText = fs.readFileSync(cvPath, "utf-8").toLowerCase();

    } else if ([".jpg", ".jpeg", ".png"].includes(ext)) {
      const { data: { text } } = await Tesseract.recognize(cvPath, "eng");
      cvText = text.toLowerCase();

    } else if (ext === ".docx") {
      const buffer = fs.readFileSync(cvPath);
      const result = await mammoth.extractRawText({ buffer });
      cvText = result.value.toLowerCase();

    } else {
      cvVerificationDetails.error = "Unsupported CV format";
      cvVerified = false;
    }

    // Case-insensitive checks
    // Name check
if (cvText.includes(fullName.toLowerCase())) {
  cvVerificationDetails.nameMatched = true;
} else {
  cvVerified = false;
}

// Service check
if (cvText.includes(service.toLowerCase())) {
  cvVerificationDetails.serviceMatched = true;
} else {
  cvVerified = false;
}

// Skills check
skills.forEach(skill => {
  if (cvText.includes(skill.toLowerCase())) {
    cvVerificationDetails.skillsMatched.push(skill);
  }
});
if (cvVerificationDetails.skillsMatched.length === 0) {
  cvVerified = false;
}

// Experience check
const experienceStr = String(yearsOfExperience).toLowerCase();
if (cvText.includes(experienceStr)) {
  cvVerificationDetails.experienceMatched = true;
  cvVerificationDetails.extractedYears = Number(yearsOfExperience);
} else {
  cvVerified = false;
}

  } catch (err) {
  console.error("CV verification error:", err);
  cvVerified = false;
  cvVerificationDetails.error = "Error reading CV";
}


  return { cvVerified, cvVerificationDetails };
}
// --------------------------


// =============== ID TYPE DETECTOR ===============
function detectIDType(text) {
if (/\d{2}-\d{2}-\d{2}-\d{5}/.test(text)) return "Citizenship";
if (/\d{2}-\d{2}-\d{3,6}/.test(text)) return "License";
if (/[A-Z][0-9]{7}/.test(text)) return "Passport";
return "Unknown";
}


// ---------------------------
// Register
// ---------------------------
// ---------------------------
// SP Register (Fixed & Robust)
// ---------------------------
// SP Register (Fixed & Robust)
// ---------------------------
router.post(
  "/sp-register",
  upload.fields([
    { name: "Profile Photo", maxCount: 1 },
    { name: "Upload ID", maxCount: 1 },
    { name: "Upload CV", maxCount: 1 },
    { name: "Portfolio", maxCount: 5 },
    { name: "Extra Certificate", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      console.log("sp: Registration started");

      const files = req.files || {};
      const body = req.body;

      console.log("sp: Body received:", body);
      console.log("sp: Files received:", Object.keys(files));

      // ---------------------------
      // Extract fields with flexibility
      // ---------------------------
      const fullName = body["Full Name"];
      const email = body["Email"];
      const phone = body["Phone"];
      const password = body["Password"];
      const sex = body["Sex"];
      const confirmPassword = body["Confirm Password"];
      const service = body["Service"];
      const yearsOfExperience = body["Year of Experience"];
      const skillsRaw = body["Skills / Expertise"] || body["Skills / Expertise "];
      const shortBio = body["Short Bio"];
      const province = body["Province"];
      const district = body["District"];
      const municipality = body["Municipality"];
      const wardNo = body["Ward No"]; 
      const idType = body["ID type"] || body["ID Type"];

      const profilePhoto = files["Profile Photo"]?.[0];
      const idDocument = files["Upload ID"]?.[0];
      const cvDocument = files["Upload CV"]?.[0];
      const portfolioFiles = files["Portfolio"] || [];
      const extraCertFiles = files["Extra Certificate"] || [];

      // ---------------------------
      // Validation
      // ---------------------------
      const missingFields = [];
      if (!fullName) missingFields.push("Full Name");
      if (!email) missingFields.push("Email");
      if (!sex) missingFields.push("Sex");
      if (!phone) missingFields.push("Phone");
      if (!password) missingFields.push("Password");
      if (!confirmPassword) missingFields.push("Confirm Password");
      if (!service) missingFields.push("Service");
      if (!yearsOfExperience) missingFields.push("Year of Experience");
      if (!skillsRaw) missingFields.push("Skills / Expertise");
      if (!province) missingFields.push("Province");
      if (!district) missingFields.push("District");
      if (!municipality) missingFields.push("Municipality");
       if (!wardNo) missingFields.push("Ward No");
      if (!idType) missingFields.push("ID type");
      if (!profilePhoto) missingFields.push("Profile Photo");
      if (!idDocument) missingFields.push("Upload ID");
      if (!cvDocument) missingFields.push("Upload CV");

      if (missingFields.length > 0) {
        console.log("sp: Missing mandatory fields:", missingFields);
        return res.status(400).json({ error: "sp: Missing mandatory fields", fields: missingFields });
      }
             // ✅ Validate gender value
            const allowedSex = ["Male", "Female", "Other"];
            if (!allowedSex.includes(sex)) {
            return res.status(400).json({ error: `Sex must be one of ${allowedSex.join(", ")}` });
                  }

      if (password !== confirmPassword)
        return res.status(400).json({ error: "sp: Passwords do not match" });
      // ✅ Minimum 8 characters password
          // Strong password validation (optional but recommended)
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
if (!strongPasswordRegex.test(password)) {
  return res.status(400).json({ 
    error: "sp: Password must be at least 8 characters and include uppercase, lowercase, number, and special character" 
  });
}

      const phoneRegex = /^\+977\d{10}$/;
      if (!phoneRegex.test(phone))
        return res.status(400).json({ error: "sp: Phone number must be in Nepal format +977XXXXXXXXXX" });

      // ---------------------------
      // Parse skills
      // ---------------------------
      const skills = typeof skillsRaw === "string"
        ? (skillsRaw.startsWith("[") ? JSON.parse(skillsRaw) : skillsRaw.split(",").map(s => s.trim()))
        : skillsRaw;

      if (!Array.isArray(skills) || skills.length === 0)
        return res.status(400).json({ error: "sp: Skills/Expertise must be a non-empty array" });

      if (await ServiceProvider.findOne({ email }))
        return res.status(400).json({ error: "sp: Email already registered" });

      // ---------------------------
      // Save files
      // ---------------------------
      const uploadBaseDir = path.join(process.cwd(), "uploads");
      const saveFile = (file, folder) => {
        const dir = path.join(uploadBaseDir, folder);
        ensureFolderExists(dir);
        const fileName = Date.now() + "-" + file.originalname.replace(/\s/g, "_");
        const fullPath = path.join(dir, fileName);
        fs.writeFileSync(fullPath, file.buffer);
        return fullPath;
      };

      const profilePath = saveFile(profilePhoto, "profile");
      const idPath = saveFile(idDocument, "id");
      const cvPath = saveFile(cvDocument, "cv");
      const portfolioPaths = portfolioFiles.map(f => saveFile(f, "Portfolio"));
      const extraCertificatePaths = extraCertFiles.map(f => saveFile(f, "Extra Certificate"));

    // Robust ID Verification
      // ---------------------------
      console.log("OCR Started...");
      const ocrText = await performOCR(idPath);
      console.log("OCR Text snippet:", ocrText.substring(0, 300));

    const stringSimilarity = require("string-similarity");

// Normalize Nepali + English characters, remove spaces/punctuation, lowercase
const normalizeText = text => {
  const nepaliMap = {
    "अ":"a","आ":"aa","इ":"i","ई":"ii","उ":"u","ऊ":"uu",
    "ए":"e","ऐ":"ai","ओ":"o","औ":"au","ऋ":"ri","ॠ":"rri",
    "ऌ":"li","ॡ":"lli",
    "ा":"a","ि":"i","ी":"ii","ु":"u","ू":"uu","े":"e","ै":"ai",
    "ो":"o","ौ":"au","ृ":"ri","ॄ":"rri","ॢ":"li","ॣ":"lli",
    "क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"ng",
    "च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"ny",
    "ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n",
    "त":"t","थ":"th","द":"d","ध":"dh","न":"n",
    "प":"p","फ":"ph","ब":"b","भ":"bh","म":"m",
    "य":"y","र":"r","ल":"l","व":"w","श":"sh",
    "ष":"sh","स":"s","ह":"h",
    "क्ष":"ksh","त्र":"tr","ज्ञ":"gy",
    "ं":"n","ः":"h","ँ":"n",
    "०":"0","१":"1","२":"2","३":"3","४":"4",
    "५":"5","६":"6","७":"7","८":"8","९":"9"
  };
  return text
    .split("")
    .map(c => nepaliMap[c] || c)
    .join("")
    .replace(/[\s\.\-_,]/g, "") // remove spaces, dots, commas, hyphens
    .toLowerCase();
};
 // Extract Nepali/English name from OCR
      const extractNepaliName = (ocrText) => {
        const nameRegex = /(?:नाम थर|Full Name)\s*[:.]\s*(.+)/i;
        const match = ocrText.match(nameRegex);
        if (match && match[1]) return match[1].trim();
        return ""; // fallback
      };

      const extractedName = extractNepaliName(ocrText);
      console.log("Extracted Name from OCR:", extractedName);
// ---------------------------
// Robust name verification (Flexible for Nepali OCR)
// ---------------------------
function verifyName(fullName, ocrText) {
  const normalize = text => text.replace(/\s+/g, "").toLowerCase();
  const nameParts = fullName.split(/\s+/).map(n => normalize(n));
  const ocrNormalized = normalize(ocrText);

  let matchCount = 0;
  for (const part of nameParts) {
    if (ocrNormalized.includes(part)) matchCount++;
  }
  console.log("Name parts matched:", matchCount, "/", nameParts.length);

  // Accept if at least 70% of name parts match
  return matchCount / nameParts.length >= 0.7;
}

 
       // Map Nepali digits to ASCII digits
const nepaliDigitMap = { "०":"0","१":"1","२":"2","३":"3","४":"4","५":"5","६":"6","७":"7","८":"8","९":"9" };
const normalizeDigits = text =>
  text.split("").map(c => nepaliDigitMap[c] || c).join("");

// Robust ward verification
const robustWardMatch = (wardNo, ocrText) => {
  // Normalize OCR text: Nepali->ASCII, remove spaces/punctuation
  const normalizedOCR = normalizeText(normalizeDigits(ocrText.replace(/वडा|ward/gi, "")));
  const normalizedWard = normalizeText(normalizeDigits(wardNo.toString()));

  // 1️⃣ Direct inclusion
  if (normalizedOCR.includes(normalizedWard)) return true;

  // 2️⃣ Fuzzy similarity fallback
  const stringSimilarity = require("string-similarity");
  const score = stringSimilarity.compareTwoStrings(normalizedWard, normalizedOCR);
  console.log(`Ward verification score: ${score.toFixed(2)}`);
  return score >= 0.7; // accept if similarity >= 70%
};
     // Extract gender/sex from OCR text
const extractSex = (ocrText) => {
  const sexRegex = /लिङ्ग|Sex\s*[:.]\s*(Male|Female|Other)/i;
  const match = ocrText.match(sexRegex);
  if (match && match[1]) return match[1].trim();
  return ""; // fallback if not found
};

const extractedSex = extractSex(ocrText);
console.log("Extracted Sex from OCR:", extractedSex);



      // Flexible ID type detection
      const robustDetectIDType = text => {
        const normalized = normalizeText(text).replace(/[-.\s]/g, "");
        if (/\d{2}\d{2}\d{2}\d{5}/.test(normalized)) return "Citizenship";
        if (/^\d{5,8}$/.test(normalized)) return "License";
        if (/^\d{10}$/.test(normalized)) return "National ID";
        if (/^[A-Z][0-9]{7}$/.test(normalized)) return "Passport";
        return "Unknown";
      };

      const nameMatch = verifyName(fullName, ocrText);
      console.log("Name Match:", nameMatch);

      const wardMatch = robustWardMatch(wardNo, ocrText);
      console.log("Ward Match:", wardMatch);

      const detectedID = robustDetectIDType(ocrText);
      const idTypeMatch = detectedID.toLowerCase() === idType.toLowerCase();
      console.log("Detected ID Type:", detectedID, "| Required:", idType);

      const sexMatch = extractedSex.toLowerCase() === sex.toLowerCase();
      console.log("Sex Match:", sexMatch);

      const passed = nameMatch && wardMatch && idTypeMatch ;
      if (!passed) {
        return res.status(400).json({
          success: false,
          message: "ID Verification Failed",
          details: { nameMatch, wardMatch, idTypeMatch, ocrTextSnippet: ocrText.substring(0, 300) }
        });
      }
       
 // ---------------------------
      // CV Verification (Case-Insensitive)
      // ---------------------------
      const { cvVerified, cvVerificationDetails } = await verifyCV(cvPath, fullName, service, skills, yearsOfExperience);
      // ---------------------------
      // Hash password
      // ---------------------------
      const hashedPassword = await bcrypt.hash(password, 10);

      // ---------------------------
      // OTP
      // ---------------------------
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000);
      await sendEmailOTP(email, otp);
      // ---------------------------
      // Save SP
      // ---------------------------
      const sp = new ServiceProvider({
        "Full Name": fullName,
        email,
        phone,
        Sex: sex,
        password: hashedPassword,
        "Profile Photo": profilePath,
        Service: service,
        "Year of Experience": yearsOfExperience,
        "Skills / Expertise": skills,
        "Short Bio": shortBio,
        Province: province,
        District: district,
        Municipality: municipality,
          "Ward No": wardNo,
        "ID type": idType,
        cvDocument: cvPath,
        Portfolio: portfolioPaths,
        "Extra Certificate": extraCertificatePaths,
        idDocument: idPath,
        idTextOCR: ocrText,
        cvVerified,
        cvVerificationDetails,
        otp,
        otpExpires,
           homeLocation: { province, district, municipality, ward: wardNo },
        currentLocation: { type: "Point", coordinates: [0, 0] },
        ratings: { avgRating: 0, totalRatings: 0 }
      });
       // ✅ Set verification flags
        sp.cvVerified = cvVerified;
        sp.idVerified = passed;
        sp.isVerified = false; // require OTP verification  
      await sp.save();
      console.log("sp: Registration successful for", email);
      res.json({ message: "sp: Registered successfully, OTP sent via email" });

    } catch (err) {
      console.error("sp: Registration error", err);
      res.status(500).json({ error: "sp: Server error", details: err.message });
    }
  }
);

// VERIFY OTP (ONE TIME)
// ===================================================
router.post("/sp-verify-otp", async (req, res) => {
  try {
    const { Email, OTP } = req.body;

    if (!Email || !OTP)
      return res.status(400).json({ error: "Email and OTP required" });

    const user = await ServiceProvider.findOne({ email: Email });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.isVerified)
      return res.status(400).json({ error: "Account already verified" });

    if (user.otp !== OTP)
      return res.status(400).json({ error: "Invalid OTP" });

    if (user.otpExpires < new Date())
      return res.status(400).json({ error: "OTP expired" });

    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();

    res.json({ message: "OTP verified successfully" });

  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// Login
// ---------------------------
router.post("/sp-login", async (req, res) => {
  try {
    const { Email, Password } = req.body;
    if (!Email || !Password) return res.status(400).json({ error: "sp: Email and password required" });

    const user = await ServiceProvider.findOne({ email: Email });
    if (!user) return res.status(400).json({ error: "sp: Email not registered" });
     if (!user.isVerified)
      return res.status(403).json({ error: "Email not verified" });
    const isMatch = await bcrypt.compare(Password, user.password);
    if (!isMatch) return res.status(400).json({ error: "sp: Invalid password" });

     // ✅ ADD ROLE HERE
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: "service_provider"   // 👈 IMPORTANT
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: "service_provider"
      }
    });
  } catch (err) {
    console.error("Login error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// Role-based Logout (Service Provider)
// ---------------------------
router.post("/sp-logout", spAuth, async (req, res) => {
  try {
    // 🔐 Role verification
    if (req.user.role !== "service_provider") {
      return res.status(403).json({ error: "Unauthorized role" });
    }

    console.log("sp: Service Provider logged out:", req.user.id);

    // 🚫 JWT is stateless → frontend must delete it
    res.json({
      success: true,
      role: "service_provider",
      message: "Service Provider logged out successfully"
    });

  } catch (err) {
    console.error("sp: Logout error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// Get own profile
// ---------------------------
router.get("/sp-me", spAuth, async (req, res) => {
  try {
    const user = await ServiceProvider.findById(req.user.id).select("-password -otp -otpExpires");
    if (!user) return res.status(404).json({ error: "sp: User not found" });
    console.log("sp: Profile fetched for", user.email);
    res.json(user);
  } catch (err) {
    console.error("sp: Profile error", err);
    res.status(500).json({ error: "sp: Server error", details: err.message });
  }
});
// Update current GPS location
// ---------------------------
router.post("/sp-location", spAuth, async (req, res) => {
  try {
    const { longitude, latitude } = req.body;
    console.log("sp: Location update request", { longitude, latitude });
    if (typeof longitude !== "number" || typeof latitude !== "number")
      return res.status(400).json({ error: "longitude and latitude required" });

    const user = await ServiceProvider.findByIdAndUpdate(req.user.id, {
      currentLocation: { type: "Point", coordinates: [longitude, latitude] }
    }, { new: true });

    console.log("sp: Location updated", user.currentLocation);
    res.json({ message: "Location updated", currentLocation: user.currentLocation });
  } catch (err) {
    console.error("sp: Location update error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});
// ---------------------------
// Resend OTP
// ---------------------------
router.post("/sp-resend-otp", async (req, res) => {
  try {
    const { Email } = req.body;
    const user = await ServiceProvider.findOne({ email: Email });
    if (!user) return res.status(400).json({ error: "sp: Email not registered" });
     if (user.isVerified)
      return res.status(400).json({ error: "Account already verified" });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
    await sendEmailOTP(Email, otp);
    console.log("sp: OTP resent for", Email);
    res.json({ message: "sp: OTP resent via email" });
  } catch (err) {
    console.error("sp: OTP resend error", err);
    res.status(500).json({ error: "sp: Server error", details: err.message });
  }
});

// ---------------------------
// File view
// ---------------------------
router.get("/sp-file/:userId/:fileType", spAuth, async (req, res) => {
  try {
    const { userId, fileType } = req.params;
    if (req.user.id !== userId) return res.status(403).json({ error: "sp: Access denied" });

    const user = await ServiceProvider.findById(userId);
    if (!user) return res.status(404).json({ error: "sp: User not found" });

    const fileMap = {
      "Upload CV": { path: user.cvDocument, type: "application/pdf" },
      "Upload ID": { path: user.idDocument, type: "image/jpeg" },
      "Profile Photo": { path: user["Profile Photo"], type: "image/jpeg" },
      Portfolio: user.Portfolio?.[0] ? { path: user.Portfolio[0], type: "image/jpeg" } : null,
      "Extra Certificate": user["Extra Certificate"]?.[0] ? { path: user["Extra Certificate"][0], type: "image/jpeg" } : null,
    };

    const fileInfo = fileMap[fileType];
    if (!fileInfo || !fileInfo.path) return res.status(404).json({ error: "sp: File not found" });

    const absolutePath = path.resolve(fileInfo.path.replace(/\\/g, "/"));
    console.log("sp: File fetched", absolutePath);
    res.sendFile(path.basename(absolutePath), { root: path.dirname(absolutePath) });
  } catch (err) {
    console.error("sp: File view error", err);
    res.status(500).json({ error: "sp: Server error", details: err.message });
  }
});

module.exports = router;
