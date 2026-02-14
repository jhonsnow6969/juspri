// backend/db.js - Database Abstraction Layer
require('dotenv').config();
const { Pool } = require('pg');

// ==================== CONNECTION POOL ====================
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'printkiosk',
    user: process.env.DB_USER || 'printuser',
    password: process.env.DB_PASSWORD,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('Unexpected database error:', err);
});

// ==================== JOBS TABLE OPERATIONS ====================

/**
 * Create a new print job
 */
async function createJob(job) {
    const query = `
        INSERT INTO jobs (
            id, user_id, kiosk_id, filename, file_path, file_size,
            pages, price_per_page, total_cost, status, payment_status,
            created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *
    `;
    
    const values = [
        job.id,
        job.user_id || null,
        job.kiosk_id,
        job.filename,
        job.file_path,
        job.file_size,
        job.pages,
        job.price_per_page,
        job.total_cost,
        job.status || 'PENDING',
        job.payment_status || 'pending'
    ];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error creating job:', error);
        throw error;
    }
}

/**
 * Get job by ID
 */
async function getJob(jobId) {
    const query = 'SELECT * FROM jobs WHERE id = $1';
    
    try {
        const result = await pool.query(query, [jobId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting job:', error);
        throw error;
    }
}

/**
 * Update job with new data
 */
async function updateJob(jobId, updates) {
    const allowedFields = [
        'status', 'payment_status', 'payment_id', 'print_token',
        'token_timestamp', 'error_message', 'pages_printed',
        'paid_at', 'queued_at', 'print_started_at', 'print_completed_at'
    ];
    
    const setClause = [];
    const values = [];
    let paramCounter = 1;
    
    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            setClause.push(`${key} = $${paramCounter}`);
            values.push(value);
            paramCounter++;
        }
    }
    
    if (setClause.length === 0) {
        return await getJob(jobId);
    }
    
    // Always update updated_at
    setClause.push(`updated_at = NOW()`);
    
    const query = `
        UPDATE jobs 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCounter}
        RETURNING *
    `;
    
    values.push(jobId);
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating job:', error);
        throw error;
    }
}

/**
 * Get all jobs with optional filters
 */
async function getJobs(filters = {}) {
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const values = [];
    let paramCounter = 1;
    
    if (filters.status) {
        query += ` AND status = $${paramCounter}`;
        values.push(filters.status);
        paramCounter++;
    }
    
    if (filters.kiosk_id) {
        query += ` AND kiosk_id = $${paramCounter}`;
        values.push(filters.kiosk_id);
        paramCounter++;
    }
    
    if (filters.user_id) {
        query += ` AND user_id = $${paramCounter}`;
        values.push(filters.user_id);
        paramCounter++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filters.limit) {
        query += ` LIMIT $${paramCounter}`;
        values.push(filters.limit);
    }
    
    try {
        const result = await pool.query(query, values);
        return result.rows;
    } catch (error) {
        console.error('Error getting jobs:', error);
        throw error;
    }
}

/**
 * Delete old jobs (for cleanup)
 */
async function deleteExpiredJobs(olderThanHours = 24) {
    const query = `
        DELETE FROM jobs 
        WHERE status IN ('EXPIRED', 'COMPLETED', 'FAILED')
        AND created_at < NOW() - INTERVAL '1 hour' * $1
        RETURNING id
    `;
    
    try {
        const result = await pool.query(query, [olderThanHours]);
        return result.rows.length;
    } catch (error) {
        console.error('Error deleting expired jobs:', error);
        throw error;
    }
}

// ==================== KIOSKS TABLE OPERATIONS ====================

/**
 * Register or update a kiosk
 */
async function upsertKiosk(kiosk) {
    const query = `
        INSERT INTO kiosks (id, hostname, printer_name, status, last_seen, socket_id, uptime)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        ON CONFLICT (id) 
        DO UPDATE SET
            hostname = EXCLUDED.hostname,
            printer_name = EXCLUDED.printer_name,
            status = EXCLUDED.status,
            last_seen = NOW(),
            socket_id = EXCLUDED.socket_id,
            uptime = EXCLUDED.uptime,
            updated_at = NOW()
        RETURNING *
    `;
    
    const values = [
        kiosk.id,
        kiosk.hostname,
        kiosk.printer_name,
        kiosk.status || 'online',
        kiosk.socket_id,
        kiosk.uptime || null
    ];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error upserting kiosk:', error);
        throw error;
    }
}

/**
 * Get kiosk by ID
 */
async function getKiosk(kioskId) {
    const query = 'SELECT * FROM kiosks WHERE id = $1';
    
    try {
        const result = await pool.query(query, [kioskId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting kiosk:', error);
        throw error;
    }
}

/**
 * Get all kiosks
 */
async function getAllKiosks() {
    const query = 'SELECT * FROM kiosks ORDER BY created_at DESC';
    
    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error getting kiosks:', error);
        throw error;
    }
}

/**
 * Update kiosk status
 */
async function updateKioskStatus(kioskId, status, lastSeen = true) {
    const query = lastSeen
        ? `UPDATE kiosks SET status = $1, last_seen = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`
        : `UPDATE kiosks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    
    try {
        const result = await pool.query(query, [status, kioskId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating kiosk status:', error);
        throw error;
    }
}

/**
 * Update kiosk heartbeat
 */
async function updateKioskHeartbeat(kioskId, uptime) {
    const query = `
        UPDATE kiosks 
        SET last_seen = NOW(), uptime = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `;
    
    try {
        const result = await pool.query(query, [uptime, kioskId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating kiosk heartbeat:', error);
        throw error;
    }
}

// ==================== USERS TABLE OPERATIONS ====================

/**
 * Create or get user
 */
async function upsertUser(user) {
    const query = `
        INSERT INTO users (id, email, name, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name
        RETURNING *
    `;
    
    const values = [user.id, user.email, user.name || null];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error upserting user:', error);
        throw error;
    }
}

/**
 * Get user by ID
 */
async function getUser(userId) {
    const query = 'SELECT * FROM users WHERE id = $1';
    
    try {
        const result = await pool.query(query, [userId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting user:', error);
        throw error;
    }
}

// ==================== STATISTICS ====================

/**
 * Get system statistics
 */
async function getStats() {
    const queries = {
        totalJobs: 'SELECT COUNT(*) as count FROM jobs',
        pendingJobs: "SELECT COUNT(*) as count FROM jobs WHERE status = 'PENDING'",
        printingJobs: "SELECT COUNT(*) as count FROM jobs WHERE status = 'PRINTING'",
        completedJobs: "SELECT COUNT(*) as count FROM jobs WHERE status = 'COMPLETED'",
        onlineKiosks: "SELECT COUNT(*) as count FROM kiosks WHERE status = 'online'",
        totalRevenue: 'SELECT COALESCE(SUM(total_cost), 0) as total FROM jobs WHERE payment_status = \'paid\''
    };
    
    try {
        const results = {};
        
        for (const [key, query] of Object.entries(queries)) {
            const result = await pool.query(query);
            results[key] = key === 'totalRevenue' 
                ? parseFloat(result.rows[0].total) 
                : parseInt(result.rows[0].count);
        }
        
        return results;
    } catch (error) {
        console.error('Error getting stats:', error);
        throw error;
    }
}

// ==================== UTILITY ====================

/**
 * Test database connection
 */
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connected:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

/**
 * Close all database connections
 */
async function closePool() {
    await pool.end();
}

// ==================== EXPORTS ====================
module.exports = {
    // Jobs
    createJob,
    getJob,
    updateJob,
    getJobs,
    deleteExpiredJobs,
    
    // Kiosks
    upsertKiosk,
    getKiosk,
    getAllKiosks,
    updateKioskStatus,
    updateKioskHeartbeat,
    
    // Users
    upsertUser,
    getUser,
    
    // Stats
    getStats,
    
    // Utility
    testConnection,
    closePool,
    
    // Direct pool access (for custom queries)
    pool
};
