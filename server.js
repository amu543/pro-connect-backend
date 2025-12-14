// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./db");
const serviceProviderRoutes = require("./routes/serviceProvider");

const app = express();

// ---------------------------
// Connect to MongoDB
// ---------------------------
connectDB();

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------
// Routes
// ---------------------------
app.use("/api/service-providers", serviceProviderRoutes);

// ---------------------------
// Serve uploads folder statically
// ---------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------------
// Root endpoint
// ---------------------------
app.get("/", (req, res) => {
  console.log("sp: Root endpoint called");
  res.send("Pro Connect API is running ✅");
});
// Ignore favicon requests
app.get("/favicon.ico", (req, res) => res.status(204).end());

// ---------------------------
// 404 handler
// ---------------------------
app.use((req, res) => {
  console.warn(`sp: 404 Not Found -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Endpoint not found" });
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 sp: Server running on http://localhost:${PORT}`));
