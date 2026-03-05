const db = require('../db');
const { kioskSockets } = require('./socket-manager');
const fs = require('fs');
const path = require('path');

const JOB_TIMEOUT_MS = 15 * 60 * 1000;

function startScheduledTasks() {
    console.log('[System] Scheduled tasks started');

    // ==========================================
    // 1. Cleanup Old Jobs (DB Records)
    // ==========================================
    setInterval(async () => {
        try {
            const now = Date.now();
            const jobs = await db.getJobs({ status: 'PENDING' });

            for (const job of jobs) {
                const createdAt = new Date(job.created_at).getTime();
                if (now - createdAt > JOB_TIMEOUT_MS) {
                    await db.updateJob(job.id, { status: 'EXPIRED' });

                    if (job.file_path && fs.existsSync(job.file_path)) {
                        fs.unlinkSync(job.file_path);
                    }

                    console.log(`[Cleanup] Job ${job.id} expired`);
                }
            }

            const deletedCount = await db.deleteExpiredJobs(24);

            if (deletedCount > 0) {
                console.log(`[Cleanup] Deleted ${deletedCount} old job records`);
            }

        } catch (error) {
            console.error('[Cleanup] DB Error:', error);
        }
    }, 60000);


    // ==========================================
    // 2. Recover Stuck Jobs (Kiosk Crash Safety)
    // ==========================================
    setInterval(async () => {
        try {

            const result = await db.query(`
                UPDATE jobs
                SET
                    status = 'PAID',
                    retry_count = retry_count + 1,
                    status_message = 'Recovered after kiosk timeout',
                    last_status_update = NOW()
                WHERE status IN ('SENT_TO_PI','PRINTING','SCANNING')
                AND last_status_update < NOW() - INTERVAL '2 minutes'
                AND retry_count < 3
                RETURNING id
            `);

            if (result.rowCount > 0) {
                console.log(`[Recovery] Requeued ${result.rowCount} stuck job(s)`);
            }

        } catch (error) {
            console.error('[Recovery] Error:', error);
        }

    }, 60000); // every minute


    // ==========================================
    // 3. Cleanup Old Job Files from Disk
    // ==========================================
    setInterval(async () => {
        try {

            const result = await db.query(`
                SELECT id, file_path
                FROM jobs
                WHERE created_at < NOW() - INTERVAL '24 hours'
                AND file_path IS NOT NULL
                AND file_path != ''
            `);

            let cleaned = 0;

            for (const job of result.rows) {

                if (fs.existsSync(job.file_path)) {
                    fs.unlinkSync(job.file_path);
                    cleaned++;
                }

            }

            if (cleaned > 0) {
                console.log(`[File Cleanup] Deleted ${cleaned} old job file(s)`);
            }

        } catch (error) {
            console.error('[File Cleanup] Error:', error);
        }

    }, 60 * 60 * 1000); // hourly


    // ==========================================
    // 4. Kiosk Health Check
    // ==========================================
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


    // ==========================================
    // 5. Delete Orphaned Files in uploads/
    // ==========================================
    setInterval(() => {

        const uploadDir = path.join(__dirname, '../uploads');
        const maxAgeMinutes = 10;

        try {

            if (!fs.existsSync(uploadDir)) return;

            const files = fs.readdirSync(uploadDir);
            const now = Date.now();

            let deletedCount = 0;

            files.forEach(file => {

                if (file.startsWith('.')) return;

                const filePath = path.join(uploadDir, file);

                try {

                    const stats = fs.statSync(filePath);
                    const ageMinutes = (now - stats.mtimeMs) / 1000 / 60;

                    if (ageMinutes > maxAgeMinutes) {

                        fs.unlinkSync(filePath);
                        deletedCount++;

                    }

                } catch {}

            });

            if (deletedCount > 0) {
                console.log(`[Storage Cleanup] Removed ${deletedCount} orphaned file(s)`);
            }

        } catch (error) {
            console.error('[Storage Cleanup] Error:', error);
        }

    }, 5 * 60 * 1000);
}

module.exports = { startScheduledTasks };