const db = require('../db');
const { kioskSockets } = require('./socket-manager');
// ===== CLEANUP FIX 2: Added Imports =====
const fs = require('fs');
const path = require('path');
// ========================================

const JOB_TIMEOUT_MS = 15 * 60 * 1000;

function startScheduledTasks() {
    console.log('[System] Scheduled tasks started');

    // 1. Cleanup Old Jobs (DB Records)
    setInterval(async () => {
        try {
            const now = Date.now();
            const jobs = await db.getJobs({ status: 'PENDING' });
            
            for (const job of jobs) {
                const createdAt = new Date(job.created_at).getTime();
                if (now - createdAt > JOB_TIMEOUT_MS) {
                    await db.updateJob(job.id, { status: 'EXPIRED' });
                    // Also delete file if job expires
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

    // ===== CLEANUP FIX 3: Delete Orphaned Files in Uploads Folder =====
    // This removes files that are > 10 minutes old from the file system
    setInterval(() => {
        const uploadDir = path.join(__dirname, '../uploads');
        const maxAgeMinutes = 10;
        
        try {
            // Ensure dir exists before reading
            if (!fs.existsSync(uploadDir)) return;

            const files = fs.readdirSync(uploadDir);
            const now = Date.now();
            let deletedCount = 0;
            
            files.forEach(file => {
                // Skip gitkeep or hidden files if needed, or specific safety checks
                if (file.startsWith('.')) return;

                const filePath = path.join(uploadDir, file);
                
                try {
                    const stats = fs.statSync(filePath);
                    const ageMinutes = (now - stats.mtimeMs) / 1000 / 60;
                    
                    if (ageMinutes > maxAgeMinutes) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                } catch (err) {
                    // File might be gone/locked
                }
            });
            
            if (deletedCount > 0) {
                console.log(`[Storage Cleanup] Removed ${deletedCount} orphaned file(s)`);
            }
        } catch (error) {
            console.error('[Storage Cleanup] Error:', error);
        }
    }, 5 * 60 * 1000); // Run every 5 minutes
    // ==================================================================
}

module.exports = { startScheduledTasks };