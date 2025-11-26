require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Root route 
app.get("/", (req, res) => {
  console.log("API is running ✅✅");
  res.send("API is running ✅");
});

// Connect to MongoDB and start server
(async () => {
  try {
    await connectDB();
    
    // Routes - require after DB is connected
    const serviceProviderRouter = require("./routes/serviceProvider");
    app.use("/api/service-providers", serviceProviderRouter);
    
    // Start server
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
})();
