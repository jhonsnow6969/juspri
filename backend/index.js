// backend/index.js (V2 - Enhanced with Queue & Token System)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } }); 

app.use(cors({ origin: '*' }));
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// ==================== IN-MEMORY DATABASE (Replace with real DB later) ====================
const jobs = new Map(); // job_id -> job object
const kiosks = new Map(); // kiosk_id -> kiosk info
const printQueue = new Map(); // kiosk_id -> array of pending jobs

// ==================== CONFIG ====================
const PRICE_PER_PAGE = 3; // Default, can be overridden per kiosk
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-in-production';
const JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// ==================== HELPER FUNCTIONS ====================

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

function validatePrintToken(token, jobId, kioskId, timestamp) {
  const expectedToken = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${jobId}:${kioskId}:${timestamp}`)
    .digest('hex');
  
  // Token valid for 1 hour
  const isRecent = (Date.now() - timestamp) < 3600000;
  return token === expectedToken && isRecent;
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

function addToQueue(kioskId, job) {
  if (!printQueue.has(kioskId)) {
    printQueue.set(kioskId, []);
  }
  printQueue.get(kioskId).push(job);
  console.log(`[Queue] Added job ${job.id} to kiosk ${kioskId}. Queue length: ${printQueue.get(kioskId).length}`);
}

function getNextJob(kioskId) {
  const queue = printQueue.get(kioskId) || [];
  return queue.shift();
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, updates, { updated_at: new Date() });
    jobs.set(jobId, job);
  }
  return job;
}

// ==================== CLEANUP OLD JOBS ====================
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (job.status === 'PENDING' && (now - job.created_at.getTime()) > JOB_TIMEOUT_MS) {
      updateJob(jobId, { status: 'EXPIRED' });
      console.log(`[Cleanup] Job ${jobId} expired`);
    }
  }
}, 60000); // Check every minute

// ==================== SOCKET.IO - KIOSK CONNECTIONS ====================
io.on('connection', (socket) => {
  console.log('[Socket] New connection:', socket.id);
  
  // Kiosk registers
  socket.on('register', (data) => {
    const { kiosk_id, hostname, printer_name } = data;
    
    kiosks.set(kiosk_id, {
      id: kiosk_id,
      hostname: hostname,
      printer_name: printer_name,
      socket_id: socket.id,
      status: 'online',
      last_seen: new Date(),
      socket: socket
    });
    
    console.log(`[Kiosk] ${kiosk_id} registered (${hostname})`);
    
    // Send queued jobs if any
    const queue = printQueue.get(kiosk_id) || [];
    console.log(`[Kiosk] ${kiosk_id} has ${queue.length} queued jobs`);
    
    if (queue.length > 0) {
      const job = getNextJob(kiosk_id);
      if (job) {
        sendJobToPi(socket, job);
      }
    }
  });
  
  // Job received by Pi
  socket.on('job_received', (data) => {
    const { job_id } = data;
    updateJob(job_id, { status: 'QUEUED', queued_at: new Date() });
    console.log(`[Job] ${job_id} received by Pi`);
  });
  
  // Print started
  socket.on('print_started', (data) => {
    const { job_id } = data;
    updateJob(job_id, { status: 'PRINTING', print_started_at: new Date() });
    console.log(`[Job] ${job_id} printing started`);
  });
  
  // Print progress
  socket.on('print_progress', (data) => {
    const { job_id, current_page, total_pages } = data;
    console.log(`[Job] ${job_id} progress: ${current_page}/${total_pages}`);
  });
  
  // Print completed
  socket.on('print_complete', (data) => {
    const { job_id, success, pages_printed, error } = data;
    
    if (success) {
      updateJob(job_id, { 
        status: 'COMPLETED', 
        print_completed_at: new Date(),
        pages_printed: pages_printed
      });
      console.log(`[Job] ${job_id} completed successfully`);
    } else {
      updateJob(job_id, { 
        status: 'FAILED',
        error_message: error
      });
      console.log(`[Job] ${job_id} failed: ${error}`);
    }
    
    // Send next job if available
    const job = jobs.get(job_id);
    if (job) {
      const nextJob = getNextJob(job.kiosk_id);
      if (nextJob) {
        const kiosk = kiosks.get(job.kiosk_id);
        if (kiosk && kiosk.socket) {
          sendJobToPi(kiosk.socket, nextJob);
        }
      }
    }
  });
  
  // Print failed
  socket.on('print_failed', (data) => {
    const { job_id, error } = data;
    updateJob(job_id, { 
      status: 'FAILED',
      error_message: error
    });
    console.log(`[Job] ${job_id} failed: ${error}`);
  });
  
  // Heartbeat
  socket.on('heartbeat', (data) => {
    const { kiosk_id } = data;
    const kiosk = kiosks.get(kiosk_id);
    if (kiosk) {
      kiosk.last_seen = new Date();
      kiosk.uptime = data.uptime;
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected:', socket.id);
    
    // Mark kiosk offline
    for (const [kioskId, kiosk] of kiosks.entries()) {
      if (kiosk.socket_id === socket.id) {
        kiosk.status = 'offline';
        console.log(`[Kiosk] ${kioskId} went offline`);
        break;
      }
    }
  });
});

// ==================== HELPER: SEND JOB TO PI ====================
function sendJobToPi(socket, job) {
  console.log(`[Send] Sending job ${job.id} to Pi`);
  
  // Read file
  fs.readFile(job.file_path, (err, data) => {
    if (err) {
      console.error(`[Send] Failed to read file for job ${job.id}:`, err);
      updateJob(job.id, { status: 'FAILED', error_message: 'File read error' });
      return;
    }
    
    // Send to Pi
    socket.emit('new_job', {
      job_id: job.id,
      filename: job.filename,
      pages: job.pages,
      fileBuffer: data
    });
    
    updateJob(job.id, { status: 'SENT_TO_PI' });
  });
}

// ==================== API ENDPOINTS ====================

// Health check
app.get('/api/status', (req, res) => {
  const onlineKiosks = Array.from(kiosks.values()).filter(k => k.status === 'online');
  res.json({
    server: 'online',
    kiosks: onlineKiosks.length,
    jobs_pending: Array.from(jobs.values()).filter(j => j.status === 'PENDING').length,
    jobs_printing: Array.from(jobs.values()).filter(j => j.status === 'PRINTING').length
  });
});

// Check kiosk connectivity
app.post('/api/connect', (req, res) => {
  const { ip, kiosk_id } = req.body;
  
  // Check if kiosk is registered and online
  const kiosk = kiosks.get(kiosk_id);
  
  if (kiosk && kiosk.status === 'online') {
    res.json({ 
      status: 'connected', 
      message: 'Kiosk is online',
      kiosk_name: kiosk.hostname,
      printer: kiosk.printer_name
    });
  } else {
    res.status(503).json({ 
      status: 'error', 
      message: 'Kiosk is offline or not found' 
    });
  }
});

// Create print job (upload PDF, get pricing)
app.post('/api/jobs/create', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const { kiosk_id } = req.body;
  
  if (!kiosk_id) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'kiosk_id required' });
  }
  
  try {
    // Count pages
    const pages = await countPDFPages(req.file.path);
    
    // Get kiosk pricing (or use default)
    const kiosk = kiosks.get(kiosk_id);
    const pricePerPage = kiosk?.price_per_page || PRICE_PER_PAGE;
    const totalCost = pages * pricePerPage;
    
    // Create job
    const jobId = generateJobId();
    const job = {
      id: jobId,
      kiosk_id: kiosk_id,
      filename: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      pages: pages,
      price_per_page: pricePerPage,
      total_cost: totalCost,
      status: 'PENDING',
      payment_status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    jobs.set(jobId, job);
    
    console.log(`[Job] Created ${jobId} - ${pages} pages, ₹${totalCost}`);
    
    res.json({
      job_id: jobId,
      pages: pages,
      price_per_page: pricePerPage,
      total_cost: totalCost,
      currency: 'INR',
      estimated_time_seconds: pages * 10 // Rough estimate
    });
    
  } catch (error) {
    console.error('Job creation error:', error);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// Verify payment and authorize print
app.post('/api/jobs/:job_id/verify-payment', async (req, res) => {
  const { job_id } = req.params;
  const { payment_id, payment_signature } = req.body;
  
  const job = jobs.get(job_id);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.status !== 'PENDING') {
    return res.status(400).json({ error: 'Job already processed' });
  }
  
  // TODO: Verify Razorpay signature (for now, mock it)
  const paymentVerified = true; // Replace with actual Razorpay verification
  
  if (!paymentVerified) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }
  
  // Update job as paid
  updateJob(job_id, {
    status: 'PAID',
    payment_status: 'paid',
    payment_id: payment_id,
    paid_at: new Date()
  });
  
  // Generate print token
  const { token, timestamp } = generatePrintToken(job_id, job.kiosk_id);
  updateJob(job_id, { 
    print_token: token,
    token_timestamp: timestamp
  });
  
  console.log(`[Payment] Job ${job_id} paid, token generated`);
  
  // Check if kiosk is online
  const kiosk = kiosks.get(job.kiosk_id);
  
  if (kiosk && kiosk.status === 'online' && kiosk.socket) {
    // Send immediately
    sendJobToPi(kiosk.socket, job);
    
    res.json({
      status: 'success',
      message: 'Payment verified, printing now',
      job_status: 'PRINTING',
      queue_position: 0
    });
  } else {
    // Queue for later
    addToQueue(job.kiosk_id, job);
    const queuePosition = (printQueue.get(job.kiosk_id) || []).length;
    
    res.json({
      status: 'success',
      message: 'Payment verified, printer offline - queued',
      job_status: 'QUEUED',
      queue_position: queuePosition
    });
  }
});

// Get job status
app.get('/api/jobs/:job_id/status', (req, res) => {
  const { job_id } = req.params;
  const job = jobs.get(job_id);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const queuePosition = printQueue.get(job.kiosk_id)?.findIndex(j => j.id === job_id) ?? -1;
  
  res.json({
    job_id: job.id,
    status: job.status,
    pages: job.pages,
    total_cost: job.total_cost,
    created_at: job.created_at,
    print_started_at: job.print_started_at,
    print_completed_at: job.print_completed_at,
    queue_position: queuePosition >= 0 ? queuePosition + 1 : null,
    error_message: job.error_message
  });
});

// Admin: List all kiosks
app.get('/api/admin/kiosks', (req, res) => {
  const kioskList = Array.from(kiosks.values()).map(k => ({
    id: k.id,
    name: k.hostname,
    status: k.status,
    printer: k.printer_name,
    last_seen: k.last_seen,
    uptime: k.uptime
  }));
  
  res.json({ kiosks: kioskList });
});

// Admin: Get all jobs
app.get('/api/admin/jobs', (req, res) => {
  const { status, kiosk_id } = req.query;
  
  let jobList = Array.from(jobs.values());
  
  if (status) {
    jobList = jobList.filter(j => j.status === status);
  }
  
  if (kiosk_id) {
    jobList = jobList.filter(j => j.kiosk_id === kiosk_id);
  }
  
  // Sort by created_at desc
  jobList.sort((a, b) => b.created_at - a.created_at);
  
  res.json({ 
    jobs: jobList.slice(0, 100), // Limit to 100
    total: jobList.length 
  });
});

// ==================== PERIODIC HEARTBEAT CHECK ====================
setInterval(() => {
  const now = Date.now();
  for (const [kioskId, kiosk] of kiosks.entries()) {
    if (kiosk.status === 'online' && kiosk.socket) {
      kiosk.socket.emit('ping');
    }
    
    // Mark as offline if no heartbeat for 60 seconds
    if (now - kiosk.last_seen.getTime() > 60000) {
      kiosk.status = 'offline';
    }
  }
}, 30000);

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   DirectPrint Server V2 - Running      ║
║   Port: ${PORT}                           ║
║   Mode: Enhanced with Queue System     ║
╚════════════════════════════════════════╝
  `);
});