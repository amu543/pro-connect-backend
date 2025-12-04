const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const path = require("path");

const app = express();

// ---------------------------
// Middleware
// ---------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ---------------------------
// MongoDB connection
// ---------------------------
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pro-connect";
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ---------------------------
// Routes
// ---------------------------
const serviceProviderRoutes = require("./routes/serviceProvider");

// Mount routes
app.use("/api/service-providers", serviceProviderRoutes);

// ---------------------------
// Serve uploads folder statically (optional)
// ---------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------------
// Default route
// ---------------------------
app.get("/", (req, res) => {
  res.send("Pro Connect API is running ✅");
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
