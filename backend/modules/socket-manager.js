// backend/modules/socket-manager.js
const db = require('../db');

// In-memory tracking
const kioskSockets = new Map();

function emitToKiosk(kioskId, eventName, payload) {
    const socket = kioskSockets.get(kioskId);
    if (!socket) return false;
    socket.emit(eventName, payload);
    return true;
}

function initSocketServer(io) {
    io.on('connection', (socket) => {
        console.log('[Socket] New connection:', socket.id);
        
        // ===== REGISTER: Initializes kiosk and printer_status =====
        socket.on('register', async (data) => {
            const { kiosk_id, hostname, printer_name } = data;
            try {
                // Using direct SQL upsert so we can initialize printer_status
                await db.query(
                    `INSERT INTO kiosks (id, hostname, printer_name, status, socket_id, last_seen, printer_status)
                     VALUES ($1, $2, $3, 'online', $4, NOW(), 'unknown')
                     ON CONFLICT (id) DO UPDATE SET
                        hostname = EXCLUDED.hostname,
                        printer_name = EXCLUDED.printer_name,
                        status = 'online',
                        socket_id = EXCLUDED.socket_id,
                        last_seen = NOW()`,
                    [kiosk_id, hostname, printer_name, socket.id]
                );

                kioskSockets.set(kiosk_id, socket);
                console.log(`[Kiosk] ${kiosk_id} registered (${hostname})`);
            } catch (error) {
                console.error('[Kiosk] Registration error:', error);
            }
        });
        
        socket.on('job_received', async (data) => {
            try {
                await db.transitionJobState(data.job_id, 'QUEUED', { message: 'Pi agent acknowledged job' });
                console.log(`[Job] ${data.job_id} received by Pi`);
            } catch (error) {
                console.error('[Job] job_received error:', error);
            }
        });
        
        socket.on('print_started', async (data) => {
            try {
                await db.transitionJobState(data.job_id, 'PRINTING', { message: 'Printing started' });
                console.log(`[Job] ${data.job_id} printing started`);
            } catch (error) {
                console.error('[Job] print_started error:', error);
            }
        });
        
        // ===== PRINT COMPLETE: Updates Job + Updates Paper Count (Phase 3) =====
        socket.on('print_complete', async (data) => {
            const { job_id, success, pages_printed, error } = data;
            try {
                if (success) {
                    // 1. Update job status to COMPLETED
                    await db.transitionJobState(job_id, 'COMPLETED', {
                        message: 'Print completed',
                        pages_printed
                    });

                    // 2. Subtract pages from kiosk paper count
                    if (pages_printed && pages_printed > 0) {
                        try {
                            // Find which kiosk printed this job
                            const jobResult = await db.query(
                                'SELECT kiosk_id FROM jobs WHERE id = $1',
                                [job_id]
                            );

                            if (jobResult.rows.length > 0) {
                                const kioskId = jobResult.rows[0].kiosk_id;

                                // Decrement paper count (ensure it doesn't go below 0)
                                await db.query(`
                                    UPDATE kiosks 
                                    SET current_paper_count = GREATEST(0, current_paper_count - $1)
                                    WHERE id = $2
                                `, [pages_printed, kioskId]);

                                console.log(`[Paper Tracking] Kiosk ${kioskId}: -${pages_printed} pages`);
                            }
                        } catch (paperError) {
                            // Log error but don't fail the job completion process
                            console.error('[Paper Tracking] Error:', paperError);
                        }
                    }

                    console.log(`[Job] ${job_id} completed successfully`);
                } else {
                    // Handle Failure
                    await db.transitionJobState(job_id, 'FAILED', {
                        message: 'Print failed',
                        error_message: error
                    });
                    console.log(`[Job] ${job_id} failed: ${error}`);
                }
            } catch (error) {
                console.error('[Job] print_complete error:', error);
            }
        });
        
        // ===== HEARTBEAT: Updates detailed status =====
        socket.on('heartbeat', async (data) => {
            try {
                // Expecting data: { kiosk_id, uptime, printer_ipp_status, printer_ipp_detail }
                await db.query(
                    `UPDATE kiosks SET
                        status = 'online',
                        last_seen = NOW(),
                        uptime = $1,
                        socket_id = $2,
                        printer_status = $3,
                        printer_status_detail = $4,
                        last_status_check = NOW()
                     WHERE id = $5`,
                    [
                        data.uptime || 0,
                        socket.id,
                        data.printer_ipp_status || 'unknown',
                        data.printer_ipp_detail || null,
                        data.kiosk_id
                    ]
                );
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
}

module.exports = {
    initSocketServer,
    kioskSockets,
    emitToKiosk
};

/*
--------------------------------------------------------------------------------
FALLBACK NOTE:
If your ../db module does NOT expose `query(...)`, and you prefer to keep using
helper functions (like db.upsertKiosk and db.updateKioskHeartbeat), here are two
options:

1) For register: keep your existing db.upsertKiosk call but ensure it accepts a
   `printer_status` field and writes it to the DB (or call a new db.upsertKioskWithPrinterStatus).

2) For heartbeat: either add a new helper in db, e.g.:
     async updateKioskHeartbeatExtended(kioskId, uptime, socketId, printerStatus, printerDetail) { ... }
   or call the existing db.updateKioskHeartbeat with the extended info by modifying
   the db helper to accept extra params and perform the SQL update shown above.

You will also need to add DB columns if they don't exist:
  ALTER TABLE kiosks ADD COLUMN printer_status text DEFAULT 'unknown';
  ALTER TABLE kiosks ADD COLUMN printer_status_detail text;
  ALTER TABLE kiosks ADD COLUMN last_status_check timestamp;
--------------------------------------------------------------------------------
*/
