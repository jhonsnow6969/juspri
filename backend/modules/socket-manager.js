const db = require('../db');

// In-memory tracking
const kioskSockets = new Map();

function initSocketServer(io) {
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
            try {
                await db.updateKioskHeartbeat(data.kiosk_id, data.uptime);
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
    kioskSockets
};
