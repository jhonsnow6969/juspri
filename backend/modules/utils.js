const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

// Constants
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-in-production';
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt', '.png', '.jpg', '.jpeg'];

// Multer Config
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  }
});

// Helpers
function generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generatePrintToken(jobId, kioskId) {
    const timestamp = Date.now();
    const token = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(`${jobId}:${kioskId}:${timestamp}`)
        .digest('hex');
    return { token, timestamp };
}

async function countPDFPages(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(dataBuffer);
        return pdfDoc.getPageCount();
    } catch (e) {
        console.error('Page count error:', e);
        return 1;
    }
}

module.exports = {
    upload,
    generateJobId,
    generatePrintToken,
    countPDFPages,
    PRICE_PER_PAGE: 3
};
