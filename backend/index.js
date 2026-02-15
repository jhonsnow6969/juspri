// backend/index.js - V5 with Pull-Based Authorization
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

const db = require('./db');
const { 
    initializeFirebase, 
    verifyToken, 
    optionalAuth,
    isAdmin,
    ensureUserExists 
} = require('./auth-middleware');

const app = express();
const server = http.createServer(app);

initializeFirebase();

// ==================== CORS ====================
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'https://qr-wifi-printer.vercel.app',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'https://justpri.duckdns.org'
    ];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.warn('CORS blocked:', origin);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

const io = new Server(server, { 
    cors: { 
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    } 
});

app.use(express.json());

// ==================== UPDATED MULTER CONFIG ====================
// Allowed file types
const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc', '.docx',
  '.txt', '.md',
  '.rtf', '.odt',
  '.png', '.jpg', '.jpeg'
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'image/png',
  'image/jpeg'
];

// Configure multer with file validation
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  }
});

// ==================== IN-MEMORY SOCKET TRACKING ====================
const kioskSockets = new Map();

// ==================== CONFIG ====================
const PRICE_PER_PAGE = 3;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-in-production';
const JOB_TIMEOUT_MS = 15 * 60 * 1000;

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

function getFileCategory(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    if (ext === '.pdf') return 'pdf';
    if (['.doc', '.docx', '.rtf', '.odt', '.txt', '.md'].includes(ext)) return 'document';
    if (['.png', '.jpg', '.jpeg'].includes(ext)) return 'image';
    
    return 'unknown';
  }
  

// ==================== CLEANUP OLD JOBS ====================
setInterval(async () => {
    try {
        const now = Date.now();
        const jobs = await db.getJobs({ status: 'PENDING' });
        
        for (const job of jobs) {
            const createdAt = new Date(job.created_at).getTime();
            if (now - createdAt > JOB_TIMEOUT_MS) {
                await db.updateJob(job.id, { status: 'EXPIRED' });
                console.log(`[Cleanup] Job ${job.id} expired`);
            }
        }
        
        const deletedCount = await db.deleteExpiredJobs(24);
        if (deletedCount > 0) {
            console.log(`[Cleanup] Deleted ${deletedCount} old jobs`);
        }
    } catch (error) {
        console.error('[Cleanup] Error:', error);
    }
}, 60000);

// ==================== SOCKET.IO (for status updates only, not job delivery) ====================
io.on('connection', (socket) => {
    console.log('[Socket] New connection:', socket.id);
    
    socket.on('register', async (data) => {
        const { kiosk_id, hostname, printer_name } = data;
        
        try {
            await db.upsertKiosk({
                id: kiosk_id,
                hostname: hostname,
                printer_name: printer_name,
                socket_id: socket.id,
                status: 'online'
            });
            
            kioskSockets.set(kiosk_id, socket);
            console.log(`[Kiosk] ${kiosk_id} registered (${hostname})`);
        } catch (error) {
            console.error('[Kiosk] Registration error:', error);
        }
    });
    
    socket.on('job_received', async (data) => {
        try {
            await db.updateJob(data.job_id, { 
                status: 'QUEUED', 
                queued_at: new Date() 
            });
            console.log(`[Job] ${data.job_id} received by Pi`);
        } catch (error) {
            console.error('[Job] job_received error:', error);
        }
    });
    
    socket.on('print_started', async (data) => {
        try {
            await db.updateJob(data.job_id, { 
                status: 'PRINTING', 
                print_started_at: new Date() 
            });
            console.log(`[Job] ${data.job_id} printing started`);
        } catch (error) {
            console.error('[Job] print_started error:', error);
        }
    });
    
    socket.on('print_complete', async (data) => {
        const { job_id, success, pages_printed, error } = data;
        
        try {
            if (success) {
                await db.updateJob(job_id, { 
                    status: 'COMPLETED', 
                    print_completed_at: new Date(),
                    pages_printed: pages_printed
                });
                console.log(`[Job] ${job_id} completed`);
            } else {
                await db.updateJob(job_id, { 
                    status: 'FAILED', 
                    error_message: error 
                });
                console.log(`[Job] ${job_id} failed: ${error}`);
            }
        } catch (error) {
            console.error('[Job] print_complete error:', error);
        }
    });
    
    socket.on('heartbeat', async (data) => {
        const { kiosk_id, uptime } = data;
        
        try {
            await db.updateKioskHeartbeat(kiosk_id, uptime);
        } catch (error) {
            console.error('[Heartbeat] Error:', error);
        }
    });
    
    socket.on('disconnect', async () => {
        console.log('[Socket] Disconnected:', socket.id);
        
        try {
            for (const [kioskId, sock] of kioskSockets.entries()) {
                if (sock.id === socket.id) {
                    await db.updateKioskStatus(kioskId, 'offline');
                    kioskSockets.delete(kioskId);
                    console.log(`[Kiosk] ${kioskId} went offline`);
                    break;
                }
            }
        } catch (error) {
            console.error('[Disconnect] Error:', error);
        }
    });
});

// ==================== API ENDPOINTS ====================

// PUBLIC ROUTES
app.get('/api/status', async (req, res) => {
    try {
        const stats = await db.getStats();
        
        res.json({
            server: 'online',
            database: 'connected',
            auth: 'firebase',
            model: 'pull-based',
            kiosks: stats.onlineKiosks,
            jobs_pending: stats.pendingJobs,
            jobs_printing: stats.printingJobs,
            jobs_completed: stats.completedJobs
        });
    } catch (error) {
        console.error('[Status] Error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

app.post('/api/connect', async (req, res) => {
    const { kiosk_id } = req.body;
    
    console.log('[API] Connect request for:', kiosk_id);
    
    try {
        const kiosk = await db.getKiosk(kiosk_id);
        
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
    } catch (error) {
        console.error('[Connect] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== NEW: PULL-BASED POLLING ENDPOINT ====================
// Pi calls this to fetch authorized jobs
app.get('/api/jobs/poll', async (req, res) => {
    const { kiosk_id } = req.query;
    
    if (!kiosk_id) {
        return res.status(400).json({ error: 'kiosk_id required' });
    }
    
    try {
        // Get oldest PAID job for this kiosk
        const jobs = await db.getJobs({ 
            kiosk_id: kiosk_id, 
            status: 'PAID',
            limit: 1 
        });
        
        if (jobs.length === 0) {
            return res.json({ jobs: [] });
        }
        
        const job = jobs[0];
        
        // Mark as QUEUED (Pi has fetched it)
        await db.updateJob(job.id, { 
            status: 'QUEUED',
            queued_at: new Date()
        });
        
        // Read file and send as base64
        if (!fs.existsSync(job.file_path)) {
            console.error(`[Poll] File not found: ${job.file_path}`);
            await db.updateJob(job.id, { 
                status: 'FAILED',
                error_message: 'File not found on server'
            });
            return res.status(404).json({ error: 'File not found' });
        }
        
        const fileData = fs.readFileSync(job.file_path);
        const fileBase64 = fileData.toString('base64');
        
        res.json({
            jobs: [{
                job_id: job.id,
                filename: job.filename,
                pages: job.pages,
                file_data: fileBase64,
                user_id: job.user_id,
                created_at: job.created_at,
                print_token: job.print_token
            }]
        });
        
        console.log(`[Poll] Job ${job.id} fetched by kiosk ${kiosk_id}`);
        
    } catch (error) {
        console.error('[Poll] Error:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// PROTECTED ROUTES

app.post('/api/jobs/create', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { kiosk_id } = req.body;
    
    if (!kiosk_id) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'kiosk_id required' });
    }
    
    try {
        await ensureUserExists(db, req.user);
        
        const ext = path.extname(req.file.originalname).toLowerCase();
        let pages = 1; // Default for non-PDF files
        
        // Only count pages for PDFs
        if (ext === '.pdf') {
            try {
                pages = await countPDFPages(req.file.path);
            } catch (e) {
                console.warn('PDF page count failed, using estimate:', e.message);
                pages = Math.ceil(req.file.size / (1024 * 100)); // Rough estimate
            }
        } else {
            // Estimate pages for other formats
            // Images: 1 page
            // Documents: Estimate based on file size
            if (['.png', '.jpg', '.jpeg'].includes(ext)) {
                pages = 1;
            } else {
                // Rough estimate: 1 page per 5KB for text documents
                pages = Math.max(1, Math.ceil(req.file.size / (1024 * 5)));
            }
            
            console.log(`[Job] Non-PDF file: ${ext}, estimated ${pages} pages`);
        }
        
        const kiosk = await db.getKiosk(kiosk_id);
        const pricePerPage = kiosk?.price_per_page || PRICE_PER_PAGE;
        const totalCost = pages * pricePerPage;
        
        const jobId = generateJobId();
        
        const job = await db.createJob({
            id: jobId,
            user_id: req.user.uid,
            kiosk_id: kiosk_id,
            filename: req.file.originalname,
            file_path: req.file.path,
            file_size: req.file.size,
            pages: pages,
            price_per_page: pricePerPage,
            total_cost: totalCost,
            status: 'PENDING',
            payment_status: 'pending'
        });
        
        console.log(`[Job] Created ${jobId} - ${req.file.originalname} (${pages} pages, ₹${totalCost}) (user: ${req.user.email})`);
        
        res.json({
            job_id: jobId,
            filename: req.file.originalname,
            file_type: ext,
            pages: pages,
            price_per_page: pricePerPage,
            total_cost: totalCost,
            currency: 'INR',
            estimated_time_seconds: pages * 10,
            note: ext !== '.pdf' ? 'File will be converted to PDF before printing' : null
        });
        
    } catch (error) {
        console.error('Job creation error:', error);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        
        if (error.message && error.message.includes('File type not allowed')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to process file' });
        }
    }
});

app.post('/api/jobs/:job_id/verify-payment', verifyToken, async (req, res) => {
    const { job_id } = req.params;
    
    try {
        const job = await db.getJob(job_id);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        if (job.user_id !== req.user.uid) {
            return res.status(403).json({ error: 'Forbidden: You can only pay for your own jobs' });
        }
        
        if (job.status !== 'PENDING') {
            return res.status(400).json({ error: 'Job already processed' });
        }
        
        const paymentVerified = true;
        
        if (!paymentVerified) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }
        
        const { token, timestamp } = generatePrintToken(job_id, job.kiosk_id);
        
        // Mark as PAID - Pi will poll and fetch it
        await db.updateJob(job_id, {
            status: 'PAID',
            payment_status: 'paid',
            payment_id: req.body.payment_id,
            paid_at: new Date(),
            print_token: token,
            token_timestamp: timestamp
        });
        
        console.log(`[Payment] Job ${job_id} paid by ${req.user.email} - awaiting Pi poll`);
        
        // Check kiosk status
        const kiosk = await db.getKiosk(job.kiosk_id);
        const isOnline = kiosk && kiosk.status === 'online';
        
        res.json({
            status: 'success',
            message: isOnline 
                ? 'Payment verified. Printer will fetch job shortly.'
                : 'Payment verified. Job queued (printer offline).',
            job_status: 'PAID',
            estimated_wait_seconds: isOnline ? 10 : null
        });
        
    } catch (error) {
        console.error('[Payment] Error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

app.get('/api/jobs/:job_id/status', verifyToken, async (req, res) => {
    const { job_id } = req.params;
    
    try {
        const job = await db.getJob(job_id);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        if (job.user_id !== req.user.uid) {
            return res.status(403).json({ error: 'Forbidden: You can only view your own jobs' });
        }
        
        let queuePosition = null;
        if (job.status === 'PAID') {
            const queuedJobs = await db.getJobs({ 
                kiosk_id: job.kiosk_id, 
                status: 'PAID' 
            });
            queuePosition = queuedJobs.findIndex(j => j.id === job_id) + 1;
        }
        
        res.json({
            job_id: job.id,
            status: job.status,
            pages: job.pages,
            total_cost: job.total_cost,
            created_at: job.created_at,
            print_started_at: job.print_started_at,
            print_completed_at: job.print_completed_at,
            queue_position: queuePosition,
            error_message: job.error_message
        });
    } catch (error) {
        console.error('[Job Status] Error:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

// ==================== USER DASHBOARD ROUTES ====================

// Get user's jobs with filtering
app.get('/api/jobs/my-jobs', verifyToken, async (req, res) => {
  try {
    const { status, limit } = req.query;
    
    const filters = {
      status: status && status !== 'all' ? status : undefined,
      limit: limit ? parseInt(limit) : 50
    };
    
    const jobs = await db.getUserJobs(req.user.uid, filters);
    
    res.json({ 
      jobs: jobs,
      total: jobs.length 
    });
  } catch (error) {
    console.error('[My Jobs] Error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get user statistics
app.get('/api/users/stats', verifyToken, async (req, res) => {
  try {
    const stats = await db.getUserStats(req.user.uid);
    
    res.json({
      totalJobs: parseInt(stats.total_jobs) || 0,
      totalPages: parseInt(stats.total_pages) || 0,
      totalSpent: parseFloat(stats.total_spent) || 0,
      successRate: parseFloat(stats.success_rate) || 0,
      thisMonth: {
        jobs: parseInt(stats.jobs_this_month) || 0,
        spent: parseFloat(stats.spent_this_month) || 0
      }
    });
  } catch (error) {
    console.error('[User Stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ADMIN ROUTES
app.get('/api/admin/kiosks', verifyToken, isAdmin, async (req, res) => {
    try {
        const kiosks = await db.getAllKiosks();
        
        const kioskList = kiosks.map(k => ({
            id: k.id,
            name: k.hostname,
            status: k.status,
            printer: k.printer_name,
            last_seen: k.last_seen,
            uptime: k.uptime
        }));
        
        res.json({ kiosks: kioskList });
    } catch (error) {
        console.error('[Admin Kiosks] Error:', error);
        res.status(500).json({ error: 'Failed to get kiosks' });
    }
});

app.get('/api/admin/jobs', verifyToken, isAdmin, async (req, res) => {
    const { status, kiosk_id } = req.query;
    
    try {
        const filters = {};
        if (status) filters.status = status;
        if (kiosk_id) filters.kiosk_id = kiosk_id;
        filters.limit = 100;
        
        const jobs = await db.getJobs(filters);
        
        res.json({ 
            jobs: jobs,
            total: jobs.length 
        });
    } catch (error) {
        console.error('[Admin Jobs] Error:', error);
        res.status(500).json({ error: 'Failed to get jobs' });
    }
});


app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        message: 'Maximum file size is 50MB' 
      });
    }
    return res.status(400).json({ error: error.message });
  } else if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});


// ==================== KIOSK HEALTH CHECK ====================
setInterval(async () => {
    try {
        const now = Date.now();
        const kiosks = await db.getAllKiosks();
        
        for (const kiosk of kiosks) {
            const kioskSocket = kioskSockets.get(kiosk.id);
            
            if (kioskSocket) {
                kioskSocket.emit('ping');
            }
            
            const lastSeen = new Date(kiosk.last_seen).getTime();
            if (kiosk.status === 'online' && now - lastSeen > 60000) {
                await db.updateKioskStatus(kiosk.id, 'offline');
                kioskSockets.delete(kiosk.id);
                console.log(`[Health] Kiosk ${kiosk.id} marked offline (timeout)`);
            }
        }
    } catch (error) {
        console.error('[Health Check] Error:', error);
    }
}, 30000);

// ==================== STARTUP ====================
const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        const dbConnected = await db.testConnection();
        
        if (!dbConnected) {
            console.error('❌ Database connection failed. Please check your configuration.');
            process.exit(1);
        }
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔═══════════════════════════════════════════╗
║   DirectPrint Server V5 - Running         ║
║   Database: PostgreSQL ✅                 ║
║   Auth: Firebase ✅                       ║
║   Model: Pull-Based ✅                    ║
║   Port: ${PORT}                             ║
╚═══════════════════════════════════════════╝

Allowed Origins:
${allowedOrigins.map(o => `  • ${o}`).join('\n')}
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down server...');
    
    try {
        await db.closePool();
        console.log('✅ Database connections closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM...');
    await db.closePool();
    process.exit(0);
});

startServer();
