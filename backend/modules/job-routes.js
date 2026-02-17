const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { verifyToken, ensureUserExists } = require('../auth-middleware');
const { upload, generateJobId, generatePrintToken, countPDFPages, PRICE_PER_PAGE } = require('./utils');

const router = express.Router();

// Kiosk Connect
router.post('/connect', async (req, res) => {
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
            res.status(503).json({ status: 'error', message: 'Kiosk is offline or not found' });
        }
    } catch (error) {
        console.error('[Connect] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Job (Upload)
router.post('/jobs/create', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { kiosk_id } = req.body;
    
    if (!kiosk_id) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'kiosk_id required' });
    }
    
    try {
        await ensureUserExists(db, req.user);
        const ext = path.extname(req.file.originalname).toLowerCase();
        let pages = 1;
        
        if (ext === '.pdf') {
            try { pages = await countPDFPages(req.file.path); } 
            catch (e) { pages = Math.ceil(req.file.size / (1024 * 100)); }
        } else if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
            pages = Math.max(1, Math.ceil(req.file.size / (1024 * 5)));
        }
        
        const kiosk = await db.getKiosk(kiosk_id);
        const pricePerPage = kiosk?.price_per_page || PRICE_PER_PAGE;
        const totalCost = pages * pricePerPage;
        const jobId = generateJobId();
        
        await db.createJob({
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
        
        console.log(`[Job] Created ${jobId} (${pages} pages)`);
        
        res.json({
            job_id: jobId,
            filename: req.file.originalname,
            file_type: ext,
            pages: pages,
            price_per_page: pricePerPage,
            total_cost: totalCost,
            currency: 'INR'
        });
    } catch (error) {
        console.error('Job creation error:', error);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to process file' });
    }
});

// Verify Payment
router.post('/jobs/:job_id/verify-payment', verifyToken, async (req, res) => {
    const { job_id } = req.params;
    try {
        const job = await db.getJob(job_id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.user_id !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
        if (job.status !== 'PENDING') return res.status(400).json({ error: 'Job already processed' });
        
        const { token, timestamp } = generatePrintToken(job_id, job.kiosk_id);
        await db.updateJob(job_id, {
            status: 'PAID',
            payment_status: 'paid',
            payment_id: req.body.payment_id,
            paid_at: new Date(),
            print_token: token,
            token_timestamp: timestamp
        });
        
        console.log(`[Payment] Job ${job_id} paid by ${req.user.email}`);
        const kiosk = await db.getKiosk(job.kiosk_id);
        const isOnline = kiosk && kiosk.status === 'online';
        
        res.json({
            status: 'success',
            message: isOnline ? 'Payment verified. Fetching...' : 'Job queued (printer offline).',
            job_status: 'PAID'
        });
    } catch (error) {
        console.error('[Payment] Error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

// Polling (Pi Agent)
router.get('/jobs/poll', async (req, res) => {
    const { kiosk_id } = req.query;
    if (!kiosk_id) return res.status(400).json({ error: 'kiosk_id required' });
    
    try {
        const jobs = await db.getJobs({ kiosk_id: kiosk_id, status: 'PAID', limit: 1 });
        if (jobs.length === 0) return res.json({ jobs: [] });
        
        const job = jobs[0];
        await db.updateJob(job.id, { status: 'QUEUED', queued_at: new Date() });
        
        if (!fs.existsSync(job.file_path)) {
            await db.updateJob(job.id, { status: 'FAILED', error_message: 'File not found on server' });
            return res.status(404).json({ error: 'File not found' });
        }
        
        const fileBase64 = fs.readFileSync(job.file_path).toString('base64');
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

// Get User Jobs
router.get('/jobs/my-jobs', verifyToken, async (req, res) => {
    try {
        const { status, limit } = req.query;
        const filters = { status: status && status !== 'all' ? status : undefined, limit: limit ? parseInt(limit) : 50 };
        const jobs = await db.getUserJobs(req.user.uid, filters);
        res.json({ jobs: jobs, total: jobs.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Get User Stats
router.get('/users/stats', verifyToken, async (req, res) => {
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
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Job Status
router.get('/jobs/:job_id/status', verifyToken, async (req, res) => {
    try {
        const job = await db.getJob(req.params.job_id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.user_id !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
        
        let queuePosition = null;
        if (job.status === 'PAID') {
            const queuedJobs = await db.getJobs({ kiosk_id: job.kiosk_id, status: 'PAID' });
            queuePosition = queuedJobs.findIndex(j => j.id === req.params.job_id) + 1;
        }
        res.json({ ...job, queue_position: queuePosition });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

module.exports = router;
