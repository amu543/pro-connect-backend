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
const auth = require("../middleware/auth");
const { performOCR } = require("../ocr");
const { generateOTP, sendEmailOTP } = require("../otp");

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
    ExtraCertificate: ["image/jpeg", "image/png", "image/jpg"],
  };
  if (!allowed[file.fieldname]) return cb(new Error("sp: Unknown file field"), false);
  if (!allowed[file.fieldname].includes(file.mimetype))
    return cb(new Error(`${file.fieldname} must be ${allowed[file.fieldname].join("/")}`), false);
  cb(null, true);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

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
  const cvVerificationDetails = [];

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
      cvVerificationDetails.push("Unsupported CV format");
      cvVerified = false;
    }

    // Case-insensitive checks
    if (!cvText.includes(fullName.toLowerCase())) { cvVerificationDetails.push("Full Name missing"); cvVerified = false; }
    if (!cvText.includes(service.toLowerCase())) { cvVerificationDetails.push("Service missing"); cvVerified = false; }
    skills.forEach(skill => { if (!cvText.includes(skill.toLowerCase())) cvVerificationDetails.push(`${skill} missing`); });
   const experienceStr = String(yearsOfExperience).trim().toLowerCase();
if (!cvText.includes(experienceStr)) {
  cvVerificationDetails.push("Experience missing");
  cvVerified = false;
}

  } catch (err) {
    console.error("CV verification error:", err);
    cvVerified = false;
    cvVerificationDetails.push("Error reading CV");
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
    { name: "ExtraCertificate", maxCount: 5 },
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

      if (password !== confirmPassword)
        return res.status(400).json({ error: "sp: Passwords do not match" });

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

      // ---------------------------
      // Robust ID Verification
      // ---------------------------
      console.log("OCR Started...");
      const ocrText = await performOCR(idPath);
      console.log("OCR Text snippet:", ocrText.substring(0, 300));

      // Flexible name check
      const robustNameMatch = (fullName, text) => {
        const parts = fullName.toLowerCase().split(" ").filter(Boolean);
        return parts.every(p => text.toLowerCase().includes(p));
      };

      // Flexible ward check
// Flexible ward check
const robustWardMatch = (wardNo, text) => {
  const regex = new RegExp(`ward\\D*${wardNo}`, "i");
  return regex.test(text);
};



      // Flexible ID type detection
      const robustDetectIDType = text => {
        const normalized = text.replace(/\s|-/g, "");
        if (/\d{2}\d{2}\d{2}\d{5}/.test(normalized)) return "Citizenship";
        if (/^\d{5,8}$/.test(normalized)) return "License";
        if (/^[A-Z][0-9]{7}$/.test(normalized)) return "Passport";
        return "Unknown";
      };

      const nameMatch = robustNameMatch(fullName, ocrText);
      console.log("Name Match:", nameMatch);

      const wardMatch = robustWardMatch(wardNo, ocrText);
      console.log("Ward Match:", wardMatch);

      const detectedID = robustDetectIDType(ocrText);
      const idTypeMatch = detectedID.toLowerCase() === idType.toLowerCase();
      console.log("Detected ID Type:", detectedID, "| Required:", idType);

      const passed = nameMatch && wardMatch && idTypeMatch;
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
        idDocument: idPath,
        cvDocument: cvPath,
        Portfolio: portfolioPaths,
        "Extra Certificate": extraCertificatePaths,
        idDocument: idPath,
        idTextOCR: ocrText,
        cvVerified,
        cvVerificationDetails,
        otp,
        otpExpires,
      });

      await sp.save();
      console.log("sp: Registration successful for", email);
      res.json({ message: "sp: Registered successfully, OTP sent via email" });

    } catch (err) {
      console.error("sp: Registration error", err);
      res.status(500).json({ error: "sp: Server error", details: err.message });
    }
  }
);



// ---------------------------
// Login
// ---------------------------
router.post("/sp-login", async (req, res) => {
  try {
    const { Email, Password } = req.body;
    if (!Email || !Password) return res.status(400).json({ error: "sp: Email and password required" });

    const user = await ServiceProvider.findOne({ email: Email });
    if (!user) return res.status(400).json({ error: "sp: Email not registered" });

    const isMatch = await bcrypt.compare(Password, user.password);
    if (!isMatch) return res.status(400).json({ error: "sp: Invalid password" });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    console.log("sp: Login successful for", Email);
    res.json({ message: "sp: Login successful", token, user: { id: user._id, email: user.email } });
  } catch (err) {
    console.error("sp: Login error", err);
    res.status(500).json({ error: "sp: Server error", details: err.message });
  }
});

// ---------------------------
// Profile
// ---------------------------
router.get("/sp-me", auth, async (req, res) => {
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

// ---------------------------
// Resend OTP
// ---------------------------
router.post("/sp-resend-otp", async (req, res) => {
  try {
    const { Email } = req.body;
    const user = await ServiceProvider.findOne({ email: Email });
    if (!user) return res.status(400).json({ error: "sp: Email not registered" });

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
router.get("/sp-file/:userId/:fileType", auth, async (req, res) => {
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
