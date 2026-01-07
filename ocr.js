const Tesseract = require("tesseract.js");

/**
 * Perform OCR on an image file and return extracted text.
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<string>} - Extracted text from the image
 */
async function performOCR(imagePath) {
  try {
    console.log(`🧐 Performing OCR on: ${imagePath}`);
    const result = await Tesseract.recognize(imagePath, "nep+eng", {
      logger: (m) => console.log("Tesseract log:", m),
    });

    const text = result.data.text.trim();
    console.log("✅ OCR Result:", text);
    return text;
  } catch (err) {
    console.error("❌ OCR error:", err.message);
    return "";
  }
}

module.exports = { performOCR };