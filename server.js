
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./db");


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // allow all origins (or restrict to your frontend)
  methods: ["GET", "POST"]

});


// ---------------------------
// Connect to MongoDB
// ---------------------------
connectDB();

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json({limit: "10mb"}));
app.use(express.urlencoded({ extended: true }));
// Make io accessible in routes
app.set("io", io);
// Helper: mount route modules safely (skip & log if module is invalid) 🔍
function safeMount(pathStr, modulePath) {
  let mod;
  try {
    mod = require(modulePath);
  } catch (err) {
    console.error(`❌ Failed to require ${modulePath}:`, err.message);
    return;
  }
const tryMount = (candidate, label) => {
    try {
      app.use(pathStr, candidate);
      console.log(`✅ Mounted ${pathStr} -> ${modulePath}${label ? ` (${label})` : ""}`);
      return true;
    } catch (err) {
      return false;
    }
  };

  if (tryMount(mod)) return;
  if (mod && typeof mod.default === "function" && tryMount(mod.default, "default")) return;
  if (mod && typeof mod.router === "function" && tryMount(mod.router, "router")) return;

  console.warn(`⚠️ Skipping mount ${pathStr}: Router.use() requires a middleware function but got ${typeof mod} -> ${modulePath}`);
  console.debug("module snapshot:", { type: typeof mod, keys: Object.getOwnPropertyNames(mod || {}), hasDefault: !!(mod && mod.default) });

  
}
// Models
// Models - register after DB connection
const Customer = require("./models/customer");
const SPServiceRequest = require("./models/spServiceRequest");
const ServiceTaken = require("./models/servicetaken");
const Notification = require("./models/notification");
const Rating = require("./models/rating");
const ServiceProvider = require("./models/ServiceProvider");

// ---------------------------
// service provider Routes
// ---------------------------
// NEW (use safeMount)
safeMount("/api/service-providers", "./routes/serviceProvider");
safeMount("/api/sp-service-page", "./routes/spservicePage");
safeMount("/api/customer", "./routes/customer");
safeMount("/api/customer/location", "./routes/location");
safeMount("/api/customer/request", "./routes/request");
safeMount("/api/customer/rating", "./routes/rating");
safeMount("/api/customer/customerDashboard", "./routes/customerDashboard");
// ---------------------------
// Serve uploads folder statically
// ---------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------------
// Root endpoint
// ---------------------------
app.get("/", (req, res) => {
  res.send("✅ Professional Connect API Running (Customer + SP)");
});

// Ignore favicon requests
app.get("/favicon.ico", (req, res) => res.status(204).end());

// ---------------------------
// 404 handler
// ---------------------------
app.use((req, res) => {
  console.warn(` 404 Not Found -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Endpoint not found" });
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Socket connected: " + socket.id);
 // Register user socket
  socket.on("register", async ({ userId, role }) => {
    try {
       if (role === "customer") {
      await Customer.findByIdAndUpdate(userId, {
        socketId: socket.id,
        isOnline: true
      });
    }

    if (role === "provider") {
      await ServiceProvider.findByIdAndUpdate(userId, {
        socketId: socket.id,
        isOnline: true
      });
    }

      socket.join(userId);
      console.log(`🔗 ${role} registered: ${userId} | socket: ${socket.id}`);
    } catch (err) {
      console.error("Socket register error:", err.message);
    }
  });

  // Customer updates location
  socket.on("update-location", async ({ userId, latitude, longitude }) => {
    try {
      await Customer.findByIdAndUpdate(userId, {
        location: { type: "Point", coordinates: [longitude, latitude] }
      });
    } catch (err) {
      console.error("Location update error:", err.message);
    }
  });



  // Cleanup on disconnect
  socket.on("disconnect", async () => {
 try {
       await Customer.findOneAndUpdate(
      { socketId: socket.id },
      { socketId: null, isOnline: false }
    );

    await ServiceProvider.findOneAndUpdate(
      { socketId: socket.id },
      { socketId: null, isOnline: false }
    );

      console.log("⚡ Socket disconnected:", socket.id);
    } catch (err) {
      console.error("Disconnect error:", err.message);
    }
  });
});
 


// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
