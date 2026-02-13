// backend/index.js (V2 - Fixed CORS + Stable Preflight + Hardened API)

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

const app = express();
const server = http.createServer(app);

/* ==================== CONFIG ==================== */

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = 'https://qr-wifi-printer.vercel.app';
const PRICE_PER_PAGE = 3;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-in-production';
const JOB_TIMEOUT_MS = 15 * 60 * 1000;

/* ==================== SOCKET.IO ==================== */

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST']
  }
});

/* ==================== GLOBAL MIDDLEWARE ==================== */

// 🔥 CORS + PREFLIGHT FIX (CRITICAL)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
const upload = multer({ dest: 'uploads/' });

/* ==================== IN-MEMORY DATABASE ==================== */

const jobs = new Map();
const kiosks = new Map();
const printQueue = new Map();

/* ==================== HELPERS ==================== */

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
    const buffer = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(buffer);
    return pdf.getPageCount();
  } catch {
    return 1;
  }
}

function addToQueue(kioskId, job) {
  if (!printQueue.has(kioskId)) {
    printQueue.set(kioskId, []);
  }
  printQueue.get(kioskId).push(job);
}

function getNextJob(kioskId) {
  const q = printQueue.get(kioskId) || [];
  return q.shift();
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, updates, { updated_at: new Date() });
  jobs.set(jobId, job);
  return job;
}

/* ==================== CLEANUP ==================== */

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (job.status === 'PENDING' && now - job.created_at > JOB_TIMEOUT_MS) {
      updateJob(id, { status: 'EXPIRED' });
    }
  }
}, 60000);

/* ==================== SOCKET EVENTS ==================== */

io.on('connection', (socket) => {
  console.log('[Socket] Connected:', socket.id);

  socket.on('register', ({ kiosk_id, hostname, printer_name }) => {
    kiosks.set(kiosk_id, {
      id: kiosk_id,
      hostname,
      printer_name,
      socket,
      socket_id: socket.id,
      status: 'online',
      last_seen: new Date()
    });

    const queued = getNextJob(kiosk_id);
    if (queued) sendJobToPi(socket, queued);
  });

  socket.on('job_received', ({ job_id }) => {
    updateJob(job_id, { status: 'QUEUED' });
  });

  socket.on('print_started', ({ job_id }) => {
    updateJob(job_id, { status: 'PRINTING', print_started_at: new Date() });
  });

  socket.on('print_complete', ({ job_id, success, error }) => {
    updateJob(job_id, {
      status: success ? 'COMPLETED' : 'FAILED',
      error_message: error
    });

    const job = jobs.get(job_id);
    if (!job) return;

    const next = getNextJob(job.kiosk_id);
    const kiosk = kiosks.get(job.kiosk_id);
    if (next && kiosk?.socket) {
      sendJobToPi(kiosk.socket, next);
    }
  });

  socket.on('heartbeat', ({ kiosk_id, uptime }) => {
    const kiosk = kiosks.get(kiosk_id);
    if (kiosk) {
      kiosk.last_seen = new Date();
      kiosk.uptime = uptime;
    }
  });

  socket.on('disconnect', () => {
    for (const kiosk of kiosks.values()) {
      if (kiosk.socket_id === socket.id) {
        kiosk.status = 'offline';
      }
    }
  });
});

/* ==================== SEND JOB ==================== */

function sendJobToPi(socket, job) {
  fs.readFile(job.file_path, (err, data) => {
    if (err) {
      updateJob(job.id, { status: 'FAILED' });
      return;
    }

    socket.emit('new_job', {
      job_id: job.id,
      filename: job.filename,
      pages: job.pages,
      fileBuffer: data
    });

    updateJob(job.id, { status: 'SENT_TO_PI' });
  });
}

/* ==================== API ==================== */

// Health
app.get('/api/status', (req, res) => {
  res.json({ server: 'online', kiosks: kiosks.size, jobs: jobs.size });
});

// 🔥 FIXED CONNECT ENDPOINT
app.post('/api/connect', (req, res) => {
  const kiosk_id = req.body?.kiosk_id;

  if (!kiosk_id) {
    return res.status(400).json({ status: 'error', message: 'kiosk_id missing' });
  }

  const kiosk = kiosks.get(kiosk_id);
  if (kiosk && kiosk.status === 'online') {
    return res.json({
      status: 'connected',
      kiosk_name: kiosk.hostname,
      printer: kiosk.printer_name
    });
  }

  res.status(503).json({ status: 'error', message: 'Kiosk offline or not found' });
});

// Create Job
app.post('/api/jobs/create', upload.single('file'), async (req, res) => {
  if (!req.file || !req.body.kiosk_id) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid request' });
  }

  const pages = await countPDFPages(req.file.path);
  const jobId = generateJobId();

  const job = {
    id: jobId,
    kiosk_id: req.body.kiosk_id,
    filename: req.file.originalname,
    file_path: req.file.path,
    pages,
    total_cost: pages * PRICE_PER_PAGE,
    status: 'PENDING',
    created_at: Date.now()
  };

  jobs.set(jobId, job);

  res.json({
    job_id: jobId,
    pages,
    total_cost: job.total_cost,
    currency: 'INR'
  });
});

// Verify Payment
app.post('/api/jobs/:job_id/verify-payment', (req, res) => {
  const job = jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  updateJob(job.id, { status: 'PAID' });

  const kiosk = kiosks.get(job.kiosk_id);
  if (kiosk?.socket) {
    sendJobToPi(kiosk.socket, job);
    return res.json({ status: 'printing' });
  }

  addToQueue(job.kiosk_id, job);
  res.json({ status: 'queued' });
});

/* ==================== START ==================== */

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DirectPrint Server running on port ${PORT}`);
});
