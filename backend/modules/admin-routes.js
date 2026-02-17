const express = require('express');
const db = require('../db');
const { verifyToken, isAdmin } = require('../auth-middleware');

const router = express.Router();

// Public Status
router.get('/status', async (req, res) => {
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

// Admin: Get Kiosks
router.get('/admin/kiosks', verifyToken, isAdmin, async (req, res) => {
    try {
        const kiosks = await db.getAllKiosks();
        res.json({ 
            kiosks: kiosks.map(k => ({
                id: k.id,
                name: k.hostname,
                status: k.status,
                printer: k.printer_name,
                last_seen: k.last_seen,
                uptime: k.uptime
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get kiosks' });
    }
});

// Admin: Get Jobs
router.get('/admin/jobs', verifyToken, isAdmin, async (req, res) => {
    const { status, kiosk_id } = req.query;
    try {
        const filters = {};
        if (status) filters.status = status;
        if (kiosk_id) filters.kiosk_id = kiosk_id;
        filters.limit = 100;
        
        const jobs = await db.getJobs(filters);
        res.json({ jobs: jobs, total: jobs.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get jobs' });
    }
});

router.post('/connect', async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json({
            ok: true,
            message: 'Backend reachable',
            kiosks: stats.onlineKiosks
        });
    } catch (err) {
        console.error('[CONNECT] failed:', err);
        res.status(503).json({ error: 'Service unavailable' });
    }
});

module.exports = router;
