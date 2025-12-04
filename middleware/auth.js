const jwt = require("jsonwebtoken");
require("dotenv").config();

const auth = (req, res, next) => {
  console.log("🔑 Auth middleware called");
  console.log("📋 Authorization header:", req.header("Authorization"));
  
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    console.log("❌ No token found in Authorization header");
    return res.status(401).json({ error: "No token, authorization denied" });
  }
  console.log("✅ Token extracted from header");

  try {
    console.log("🔍 Verifying JWT token...");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token verified successfully. User:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ JWT verification error:", err.message);
    res.status(401).json({ error: "Token is not valid" });
  }
};

module.exports = auth;