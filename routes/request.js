const router = require("express").Router();
const Customer = require("../models/customer");
const ServiceRequest = require("../models/spServiceRequest");
const ServiceTaken = require("../models/servicetaken");
const Notification = require("../models/notification");
const ServiceProvider = require("../models/ServiceProvider");
const customerAuth = require("../middleware/customerAuth"); 
/* ============================

/* ============================
   2. SELECT SERVICE
   → Notify ALL providers of that service
============================ */
router.post("/select-service", async (req, res) => {
  try {
    const { serviceType } = req.body;

    const providers = await ServiceProvider.find({
      role: "provider",
      service: { $regex: new RegExp(`^${serviceType}$`, "i") },
    });

    const io = req.app.get("io");

    providers.forEach((provider) => {
      if (provider.socketId) {
        io.to(provider.socketId).emit("service-alert", {
          message: "A customer is looking for your service",
          serviceType
        });
      }
      // else → offline (store later if needed)
    });

    res.json({
      msg: "Providers notified (online via socket)",
      totalProviders: providers.length
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});
/* ============================
   3. SEND REQUEST
   → Create request
   → Notify provider
   → Notify customer
============================ */
router.post("/send-request", customerAuth, async (req, res) => {
  try {
     const customerId = req.user.id; 
    const { providerId, serviceType } = req.body;
    if (!providerId || !serviceType) {
      return res.status(400).json({ msg: "providerId and serviceType required" });
    }

    const customer = await Customer.findById(customerId).select(
      "Full Name phone location"
    );
    const provider = await ServiceProvider.findById(providerId).select("socketId isOnline currentLocation");

    if (!customer )
      return res.status(404).json({ msg: "Customer not found" });
    if (!provider) {
      return res.status(404).json({ msg: "Service provider not found" });
    }
     if (!provider.isOnline) {
      return res.status(400).json({ msg: "Provider is offline" });
    }
    if (
  !customer.location ||
  !Array.isArray(customer.location.coordinates) ||
  customer.location.coordinates.length !== 2
) {
  return res.status(400).json({ msg: "Customer location not set. Enable GPS or update location." });
}
    const request = await ServiceRequest.create({
      customer: customerId,
      provider: providerId,
      service: serviceType,
      location:{
        type: "Point",
        coordinates: customer.location.coordinates
      },
      status: "pending"
    });

    const io = req.app.get("io");

    // 🔔 Notify provider (name + phone)
    if (provider.socketId) {
      io.to(provider.socketId).emit("service-request", {
        requestId: request._id,
        serviceType,
        customer: {
          id: customer._id,
          name: customer["Full Name"],
          phone: customer.phone
        }
      });
    }

    // 🔔 Notify customer (stored)
    await Notification.create({
      user: customerId,
      message: "Request for ${serviceType} sent successfully"
    });

    res.json({ msg: "Request sent", requestId: request._id });
  } catch (err) {
     console.error("send-request error:", err); // <-- log full error
  res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* ============================
   4. MY REQUESTS
   → ONLY accepted
============================ */
router.get("/my-requests/:customerId", async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      customer: req.params.customerId,
      status: "accepted"
    }).populate("provider", "Full Name phone Profile Photo");

    res.json(requests);
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ============================
   5. COMPLETE SERVICE
   → Move to ServiceTaken
============================ */
router.post("/complete/:requestId", async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.requestId);

    if (!request)
      return res.status(404).json({ msg: "Request not found" });

    await ServiceTaken.create({
      customer: request.customer,
      provider: request.provider,
      service: request.service,
      completedAt: new Date(),
      completedBy: "customer"
    });

    await ServiceRequest.findByIdAndDelete(request._id);
     const io = req.app.get("io");
    io.to(request.provider.toString()).emit("service-completed", {
      requestId: request._id
    });

    res.json({ msg: "Service completed" });
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ============================
   6. CUSTOMER NOTIFICATIONS
============================ */
router.get("/notifications/:customerId", async (req, res) => {
  const notifications = await Notification.find({
    user: req.user.id
  }).sort({ createdAt: -1 });

  res.json(notifications);
});
//cancel request
router.post("/cancel/:requestId", customerAuth, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { requestId } = req.params;

    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.customer.toString() !== req.user.id.toString())
      return res.status(403).json({ message: "Access denied: Not your request" });

    if (!["pending", "in-progress","accepted"].includes(request.status))
      return res.status(400).json({ message: `Cannot cancel a ${request.status} request` });

    // ✅ Set status to customer-cancelled
    request.status = "customer-cancelled";
    request.cancelledAt = new Date();
    await request.save();

    res.json({ message: "Request cancelled successfully", requestId: request._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});
//rejected request move to reject page
router.get("/rejected", customerAuth, async (req, res) => {
  try {
    const customerId = req.user.id;

    // Fetch requests cancelled by customer
    const cancelledRequests = await ServiceRequest.find({
      customer: customerId,
      status: "customer-cancelled",
    })
      .populate("provider", "fullName email phone") // provider info
      .sort({ cancelledAt: -1 });

    res.json({ count: cancelledRequests.length, requests: cancelledRequests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});
module.exports = router;