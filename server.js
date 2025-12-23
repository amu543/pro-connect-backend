// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./db");
const serviceProviderRoutes = require("./routes/serviceProvider");
const servicePageRoutes = require("./routes/spservicePage");
const ratingRoutes = require("./routes/sprating");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // allow all origins (or restrict to your frontend)
});


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
// Make io accessible in routes
app.set("io", io);
// ---------------------------
// Routes
// ---------------------------
app.use("/api/service-providers", serviceProviderRoutes);
app.use("/api/sp-ratings", ratingRoutes);
app.use("/api/sp-service-page", servicePageRoutes);
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

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Socket connected: " + socket.id);
 // Any user (SP or Customer) joins their own room
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });
 
  socket.on("disconnect", () => {
    console.log("SP disconnected:", socket.id);
  });
});



// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 sp: Server running on http://localhost:${PORT}`));
