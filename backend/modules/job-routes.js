const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { verifyToken, ensureUserExists } = require('../auth-middleware');
const { upload, generateJobId, generatePrintToken, countPDFPages, PRICE_PER_PAGE } = require('./utils');
const socketManager = require('./socket-manager');

const router = express.Router();


// ===============================
// Kiosk Connect
// ===============================
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
                printer: kiosk.printer_name,
                paper_count: kiosk.current_paper_count
            });
        } else {
            res.status(503).json({ status: 'error', message: 'Kiosk is offline or not found' });
        }

    } catch (error) {
        console.error('[Connect] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ===============================
// Create Print Job
// ===============================
router.post('/jobs/create', verifyToken, upload.single('file'), async (req, res) => {

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
        let pages = 1;

        if (ext === '.pdf') {
            try {
                pages = await countPDFPages(req.file.path);
            } catch {
                pages = Math.ceil(req.file.size / (1024 * 100));
            }
        }

        const kiosk = await db.getKiosk(kiosk_id);

        if (!kiosk) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Kiosk not found' });
        }

        const paperAvailable = kiosk.current_paper_count || 0;

        if (paperAvailable < pages) {

            fs.unlinkSync(req.file.path);

            return res.status(400).json({
                error: 'INSUFFICIENT_PAPER',
                paperAvailable,
                paperNeeded: pages
            });
        }

        const pricePerPage = kiosk.price_per_page || PRICE_PER_PAGE;
        const totalCost = pages * pricePerPage;
        const jobId = generateJobId();

        await db.createJob({
            id: jobId,
            user_id: req.user.uid,
            kiosk_id,
            filename: req.file.originalname,
            file_path: req.file.path,
            file_size: req.file.size,
            pages,
            price_per_page: pricePerPage,
            total_cost: totalCost,
            status: 'PENDING',
            payment_status: 'pending',
            job_type: 'print'
        });

        res.json({
            job_id: jobId,
            pages,
            total_cost: totalCost,
            currency: 'INR'
        });

    } catch (error) {

        console.error('Job creation error:', error);

        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: 'Failed to process file' });
    }
});


// ===============================
// Verify Payment
// ===============================
router.post('/jobs/:job_id/verify-payment', verifyToken, async (req, res) => {

    const { job_id } = req.params;

    try {

        const job = await db.getJob(job_id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.user_id !== req.user.uid) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { token, timestamp } = generatePrintToken(job_id, job.kiosk_id);

        await db.updateJob(job_id, {
            status: 'PAID',
            payment_status: 'paid',
            payment_id: req.body.payment_id,
            paid_at: new Date(),
            print_token: token,
            token_timestamp: timestamp
        });

        res.json({ status: 'success', job_status: 'PAID' });

    } catch (error) {
        console.error('[Payment] Error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});


// ===============================
// Poll for Jobs (Pi Agent)
// ===============================
router.get('/jobs/poll', async (req, res) => {

    const { kiosk_id } = req.query;

    if (!kiosk_id) {
        return res.status(400).json({ error: 'kiosk_id required' });
    }

    try {

        const result = await db.query(`
            UPDATE jobs
            SET status = 'SENT_TO_PI',
                queued_at = NOW(),
                last_status_update = NOW()
            WHERE id = (
                SELECT id
                FROM jobs
                WHERE kiosk_id = $1
                AND status = 'PAID'
                ORDER BY created_at
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `, [kiosk_id]);

        if (result.rows.length === 0) {
            return res.json({ jobs: [] });
        }

        const job = result.rows[0];

        res.json({
            jobs: [{
                job_id: job.id,
                filename: job.filename,
                pages: job.pages,
                job_type: job.job_type,
                download_url: `/api/jobs/${job.id}/download`
            }]
        });

    } catch (err) {
        console.error('[Poll] Error:', err);
        res.status(500).json({ error: 'Poll failed' });
    }

});


// ===============================
// Download Job File (Pi Agent)
// ===============================
router.get('/jobs/:job_id/download', async (req, res) => {

    const { job_id } = req.params;

    try {

        const job = await db.getJob(job_id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (!fs.existsSync(job.file_path)) {
            return res.status(404).json({ error: 'File missing' });
        }

        res.download(job.file_path, job.filename);

    } catch (error) {
        console.error('[Download] Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ===============================
// Create Scan Job
// ===============================
router.post('/jobs/scan', verifyToken, async (req, res) => {

    try {

        const { kiosk_id, scan_options } = req.body;

        if (!kiosk_id) {
            return res.status(400).json({ error: 'kiosk_id required' });
        }

        const jobId = generateJobId();

        await db.createJob({
            id: jobId,
            user_id: req.user.uid,
            kiosk_id,
            job_type: 'scan',
            filename: `scan_${Date.now()}.pdf`,
            file_path: '',
            file_size: 0,
            pages: 1,
            price_per_page: 0,
            total_cost: 5,
            status: 'QUEUED',
            scan_options: scan_options || {}
        });

        const kioskSocket = socketManager.getKioskSocket(kiosk_id);

        if (kioskSocket) {
            kioskSocket.emit('scan_job', {
                job_id: jobId,
                scan_options: scan_options || {}
            });
        }

        res.json({
            job_id: jobId,
            status: 'QUEUED'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ===============================
// Upload Scan Result
// ===============================
router.post('/jobs/:job_id/scan-upload', upload.single('file'), async (req, res) => {

    try {

        const { job_id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const downloadURL =
            `${process.env.BACKEND_URL}/api/jobs/${job_id}/download`;

        await db.updateJob(job_id, {
            status: 'COMPLETED',
            output_file_url: downloadURL,
            file_path: req.file.path,
            file_size: req.file.size
        });

        res.json({
            success: true,
            download_url: downloadURL
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;