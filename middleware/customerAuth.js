// middleware/customerAuth.js
const jwt = require("jsonwebtoken");
const Customer = require("../models/customer");
require("dotenv").config();

const customerAuth = async (req, res, next) => {
  try {
    // 1️⃣ Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ msg: "No token, authorization denied" });

    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Fetch user from DB
    const user = await Customer.findById(decoded.id);
    if (!user) return res.status(404).json({ msg: "Customer not found" });

    // 4️⃣ Attach user to request
    req.user = {
      id: user._id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    };

    console.log(`✅ customer: Auth verified for user: ${user.email}`);

    next();
  } catch (err) {
    console.error("Customer auth error:", err.message);
    res.status(401).json({ msg: "Token is not valid" });
  }
};

module.exports = customerAuth;
