const nodemailer = require("nodemailer");
require("dotenv").config();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

async function sendEmailOTP(email, otp) {
  console.log(`sp: Sending OTP ${otp} to email ${email}`);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_SERVICE_USER,
      pass: process.env.EMAIL_SERVICE_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_SERVICE_USER,
    to: email,
    subject: "Your Pro Connect OTP",
    text: `Your OTP is: ${otp} (valid for 5 minutes)`,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { generateOTP, sendEmailOTP };