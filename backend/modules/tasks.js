const db = require('../db');
const { kioskSockets } = require('./socket-manager');

const JOB_TIMEOUT_MS = 15 * 60 * 1000;

function startScheduledTasks() {
    // 1. Cleanup Old Jobs
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

    // 2. Kiosk Health Check
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
}

module.exports = { startScheduledTasks };
