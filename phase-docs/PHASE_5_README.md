# Phase 5: Document Conversion - Complete Guide

## 🎯 Goal
Support multiple document formats beyond PDF. Users should be able to print DOCX, DOC, TXT, images (PNG, JPG), and more without manual conversion.

## 📋 What We're Adding

### Current:
- ✅ PDF only

### After Phase 5:
- ✅ PDF (pass-through, no conversion)
- ✅ Microsoft Word (DOCX, DOC)
- ✅ Text files (TXT, MD)
- ✅ Images (PNG, JPG, JPEG)
- ✅ Rich Text Format (RTF)
- ✅ OpenDocument (ODT)

## 🏗️ Architecture

### Backend Changes:
- Accept multiple file types in upload
- Validate file extensions
- Pass original file to Pi
- Let Pi handle conversion

### Pi Agent Changes:
- Detect file type
- Convert to PDF if needed
- Count pages after conversion
- Print the PDF

### Conversion Tools:
1. **LibreOffice** (headless) - For documents (DOCX, DOC, RTF, ODT, TXT, MD)
2. **ImageMagick** - For images (PNG, JPG, JPEG)

## ⚡ Quick Implementation

### Step 1: Install Conversion Tools on Pi

```bash
# Update system
sudo apt update

# Install LibreOffice (headless, no GUI)
sudo apt install -y libreoffice-writer libreoffice-core-nogui

# Install ImageMagick
sudo apt install -y imagemagick

# Verify installations
libreoffice --version
convert --version
```

### Step 2: Update Pi Agent

The updated pi-agent includes:
- File type detection
- Automatic conversion to PDF
- Support for all major formats

### Step 3: Update Backend (Optional)

Relaxed file type validation to accept more formats.

## 🚀 Implementation Details

### File Type Detection

```javascript
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  if (ext === '.pdf') return 'pdf';
  if (['.doc', '.docx', '.rtf', '.odt', '.txt', '.md'].includes(ext)) return 'document';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return 'image';
  
  return 'unknown';
}
```

### Document Conversion (LibreOffice)

```javascript
async function convertToPDF(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `libreoffice --headless --convert-to pdf --outdir "${path.dirname(outputPath)}" "${inputPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Conversion failed: ${stderr}`));
      } else {
        resolve(outputPath);
      }
    });
  });
}
```

### Image Conversion (ImageMagick)

```javascript
async function convertImageToPDF(imagePath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `convert "${imagePath}" -page A4 -gravity center "${outputPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Image conversion failed: ${stderr}`));
      } else {
        resolve(outputPath);
      }
    });
  });
}
```

## 📋 Conversion Pipeline

```
1. Receive file from backend
   └→ Save to temp directory

2. Detect file type
   └→ PDF: Skip conversion
   └→ Document: Use LibreOffice
   └→ Image: Use ImageMagick

3. Convert to PDF (if needed)
   └→ Save as temp.pdf

4. Count pages in PDF
   └→ Verify conversion worked

5. Send to printer (CUPS)
   └→ Print the PDF

6. Cleanup temp files
```

## 🧪 Testing Each Format

### Test PDF (No Conversion)
```bash
# Should work as before
curl -X POST http://localhost:3001/api/jobs/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "kiosk_id=test_kiosk"
```

### Test DOCX
```bash
# Create test DOCX
echo "Test Document" | pandoc -o test.docx

# Upload
curl -X POST http://localhost:3001/api/jobs/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.docx" \
  -F "kiosk_id=test_kiosk"
```

### Test TXT
```bash
# Create test TXT
echo "Hello World\nThis is a test\nLine 3" > test.txt

# Upload
curl -X POST http://localhost:3001/api/jobs/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.txt" \
  -F "kiosk_id=test_kiosk"
```

### Test Image
```bash
# Create test image
convert -size 800x600 xc:white -pointsize 72 -draw "text 200,300 'Test Image'" test.png

# Upload
curl -X POST http://localhost:3001/api/jobs/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.png" \
  -F "kiosk_id=test_kiosk"
```

## 🔧 Configuration

### LibreOffice Options

```javascript
// Basic conversion
libreoffice --headless --convert-to pdf input.docx

// With specific output directory
libreoffice --headless --convert-to pdf --outdir /tmp input.docx

// Filter options (quality)
libreoffice --headless --convert-to pdf:"writer_pdf_Export" input.docx
```

### ImageMagick Options

```javascript
// Basic conversion
convert input.jpg output.pdf

// Fit to A4 page
convert input.jpg -page A4 -gravity center output.pdf

// Multiple images to single PDF
convert img1.jpg img2.jpg img3.jpg output.pdf

// With compression
convert input.jpg -quality 85 -compress jpeg output.pdf
```

## 🚨 Common Issues & Solutions

### Issue 1: LibreOffice Not Found

**Symptom:**
```
Error: libreoffice: command not found
```

**Solution:**
```bash
# Reinstall LibreOffice
sudo apt install --reinstall libreoffice-writer libreoffice-core-nogui

# Check if installed
which libreoffice
dpkg -l | grep libreoffice
```

### Issue 2: Conversion Timeout

**Symptom:**
```
Error: Conversion timed out
```

**Solution:**
```javascript
// Increase timeout
exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
  // 30 second timeout
});
```

### Issue 3: ImageMagick Policy Error

**Symptom:**
```
convert: not authorized `output.pdf' @ error/constitute.c
```

**Solution:**
```bash
# Edit ImageMagick policy
sudo nano /etc/ImageMagick-6/policy.xml

# Find this line:
# <policy domain="coder" rights="none" pattern="PDF" />

# Change to:
# <policy domain="coder" rights="read|write" pattern="PDF" />

# Save and restart
```

### Issue 4: Poor Quality Conversion

**For Documents:**
```javascript
// Use better LibreOffice export settings
libreoffice --headless --convert-to "pdf:writer_pdf_Export:SelectPdfVersion=1" input.docx
```

**For Images:**
```javascript
// Higher quality
convert input.jpg -quality 95 -density 300 output.pdf
```

### Issue 5: Large Files Timeout

**Solution:**
```javascript
// Increase all timeouts
const CONVERSION_TIMEOUT = 60000; // 60 seconds
const DOWNLOAD_TIMEOUT = 120000;  // 2 minutes
```

## 📊 Supported Formats Summary

| Format | Extension | Tool | Status |
|--------|-----------|------|--------|
| PDF | .pdf | None (pass-through) | ✅ |
| Word | .docx, .doc | LibreOffice | ✅ |
| Rich Text | .rtf | LibreOffice | ✅ |
| OpenDocument | .odt | LibreOffice | ✅ |
| Plain Text | .txt | LibreOffice | ✅ |
| Markdown | .md | LibreOffice | ✅ |
| PNG Image | .png | ImageMagick | ✅ |
| JPEG Image | .jpg, .jpeg | ImageMagick | ✅ |

## 🎨 Advanced: Custom Conversion Settings

### Better Text File Formatting

```javascript
async function convertTextToPDF(txtPath, outputPath) {
  // Create a temporary HTML file with better formatting
  const content = fs.readFileSync(txtPath, 'utf8');
  const html = `
    <html>
      <head><style>
        body { font-family: monospace; margin: 2cm; line-height: 1.5; }
        pre { white-space: pre-wrap; }
      </style></head>
      <body><pre>${content}</pre></body>
    </html>
  `;
  
  const htmlPath = txtPath.replace('.txt', '.html');
  fs.writeFileSync(htmlPath, html);
  
  // Convert HTML to PDF
  await convertToPDF(htmlPath, outputPath);
  fs.unlinkSync(htmlPath);
}
```

### Image Quality Presets

```javascript
const imageQuality = {
  draft: { quality: 70, density: 150 },
  standard: { quality: 85, density: 200 },
  high: { quality: 95, density: 300 }
};

function convertImageToPDF(imagePath, outputPath, preset = 'standard') {
  const { quality, density } = imageQuality[preset];
  const cmd = `convert "${imagePath}" -quality ${quality} -density ${density} -page A4 "${outputPath}"`;
  // ... execute
}
```

## 📈 Performance Optimization

### Conversion Time by Format:
- PDF: 0s (no conversion)
- TXT: ~1-2s
- DOCX (1 page): ~3-5s
- DOCX (10 pages): ~5-8s
- Image: ~2-3s

### Parallel Processing (Optional):

If you get many jobs:
```javascript
// Process multiple conversions in parallel
const queue = require('better-queue');

const conversionQueue = new queue(async (job, cb) => {
  try {
    await convertFile(job.path);
    cb(null, 'success');
  } catch (err) {
    cb(err);
  }
}, { concurrent: 3 }); // 3 at a time
```

## 🔐 Security Considerations

### File Size Limits

```javascript
// In backend
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});
```

### File Type Validation

```javascript
// Validate MIME type, not just extension
const fileType = require('file-type');

async function validateFile(filePath) {
  const type = await fileType.fromFile(filePath);
  
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg'
  ];
  
  if (!allowed.includes(type?.mime)) {
    throw new Error('File type not allowed');
  }
}
```

### Malicious File Protection

```bash
# Run LibreOffice with restricted permissions
sudo -u nobody libreoffice --headless --convert-to pdf input.docx

# Disable macros
libreoffice --headless --norestore --nologo --convert-to pdf input.docx
```

## 📱 Frontend Updates

### Accept Multiple File Types

```javascript
// In frontend file input
<input 
  type="file" 
  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.rtf,.odt,.md"
  onChange={handleFileSelect}
/>
```

### Show File Type Icon

```javascript
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  const icons = {
    pdf: '📄',
    doc: '📝', docx: '📝',
    txt: '📃', md: '📃',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️'
  };
  
  return icons[ext] || '📎';
}
```

## ✅ Testing Checklist

- [ ] LibreOffice installed and working
- [ ] ImageMagick installed and working
- [ ] Can convert DOCX to PDF
- [ ] Can convert TXT to PDF
- [ ] Can convert images to PDF
- [ ] Original PDFs still work (no regression)
- [ ] Page counting works after conversion
- [ ] Temp files cleaned up after conversion
- [ ] Error handling works for invalid files
- [ ] Frontend accepts multiple file types

## 🚀 What's Next

After Phase 5:
- ✅ Multi-format document support
- ✅ Automatic conversion to PDF
- ✅ Better user experience

**Remaining Phases:**
- **Phase 6:** Bluetooth File Transfer (optional)
- **Phase 7:** Razorpay Integration (payment)

---

**Ready to implement?** This phase significantly improves user experience - no more "sorry, we only accept PDFs"! 🎯
