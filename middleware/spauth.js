//middleware/spauth.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

const spAuth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "service_provider") {
      return res.status(403).json({ error: "Access denied" });
    }
    req.user = decoded;
     console.log("✅ sp: Auth verified for user:", decoded.email);
    next();
  } catch (err) {
     console.error("❌ sp: Auth failed", err.message);
    res.status(401).json({ error: "Token is not valid" });
  }
};

module.exports = spAuth;