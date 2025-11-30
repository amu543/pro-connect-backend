require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------
// 1️⃣ Auto-create upload folders (with absolute paths)
// ---------------------------
const uploadBaseDir = path.join(__dirname, "uploads");
const uploadDirs = [
  path.join(uploadBaseDir, "cv"),
  path.join(uploadBaseDir, "id"),
  path.join(uploadBaseDir, "profile"),
  path.join(uploadBaseDir, "other"),
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created folder: ${dir}`);
  }
});

// ---------------------------
// 2️⃣ Middlewares
// ---------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✅ Add this for form-data

// Serve uploads statically
app.use("/uploads", express.static("uploads"));

// ---------------------------
// 3️⃣ Routes
// ---------------------------
app.get("/", (req, res) => res.send("API is running ✅"));

// ---------------------------
// 4️⃣ Connect DB and start server
// ---------------------------
(async () => {
  await connectDB();

  const serviceProviderRouter = require("./routes/serviceProvider");
  app.use("/api/service-providers", serviceProviderRouter);

  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
})();
