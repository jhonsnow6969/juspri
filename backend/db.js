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
            job_type, metadata, created_at, updated_at, last_status_update
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13::jsonb, NOW(), NOW(), NOW()
        )
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
        job.payment_status || 'pending',
        job.job_type || 'print',
        JSON.stringify(job.metadata || {})
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
        'paid_at', 'queued_at', 'print_started_at', 'print_completed_at',
        'metadata', 'status_message', 'last_status_update', 'job_type',
        'output_file_url', 'scan_options', 'retry_count', 'file_path', 'file_size'
    ];
    
    const setClause = [];
    const values = [];
    let paramCounter = 1;
    
    for (const [key, value] of Object.entries(updates)) {
        if (!allowedFields.includes(key)) continue;

        if (key === 'metadata' || key === 'scan_options') {
            setClause.push(`${key} = $${paramCounter}::jsonb`);
            values.push(typeof value === 'string' ? value : JSON.stringify(value || {}));
            paramCounter++;
            continue;
        }

        setClause.push(`${key} = $${paramCounter}`);
        values.push(value);
        paramCounter++;
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
 * Transition job to a new state with consistent metadata updates.
 */
async function transitionJobState(jobId, status, options = {}) {
    const updates = {
        status,
        status_message: options.status_message || options.message || null,
        last_status_update: new Date()
    };

    if (options.error_message) updates.error_message = options.error_message;
    if (typeof options.pages_printed === 'number') updates.pages_printed = options.pages_printed;

    const knownTimestamps = {
        PAID: 'paid_at',
        QUEUED: 'queued_at',
        PRINTING: 'print_started_at',
        COMPLETED: 'print_completed_at'
    };

    const timestampKey = knownTimestamps[status];
    if (timestampKey) updates[timestampKey] = new Date();

    return updateJob(jobId, updates);
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
 * Atomically claim the next PAID job for a kiosk.
 * Uses FOR UPDATE SKIP LOCKED to prevent duplicate dispatch.
 */
async function getNextPrintJob(kioskId) {
    const query = `
        UPDATE jobs
        SET status = 'QUEUED', queued_at = NOW(), updated_at = NOW()
        WHERE id = (
            SELECT id FROM jobs
            WHERE kiosk_id = $1 AND status = 'PAID'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING *
    `;

    try {
        const result = await pool.query(query, [kioskId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting next print job:', error);
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

/**
 * Get user's jobs with optional filtering
 */
async function getUserJobs(userId, filters = {}) {
    try {
        let query = 'SELECT * FROM jobs WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        
        // Add status filter
        if (filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }
        
        // Add date range filter (optional)
        if (filters.startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(filters.startDate);
            paramIndex++;
        }
        
        if (filters.endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(filters.endDate);
            paramIndex++;
        }
        
        // Order by newest first
        query += ' ORDER BY created_at DESC';
        
        // Add limit
        const limit = filters.limit || 50;
        query += ` LIMIT $${paramIndex}`;
        params.push(limit);
        
        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting user jobs:', error);
        throw error;
    }
}

/**
 * Get user statistics
 */
async function getUserStats(userId) {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_jobs,
                COALESCE(SUM(pages), 0) as total_pages,
                COALESCE(SUM(total_cost), 0) as total_spent,
                COALESCE(
                    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::float / NULLIF(COUNT(*), 0),
                    0
                ) as success_rate,
                COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as jobs_this_month,
                COALESCE(
                    SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN total_cost ELSE 0 END),
                    0
                ) as spent_this_month
            FROM jobs 
            WHERE user_id = $1
        `, [userId]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error getting user stats:', error);
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
    transitionJobState,
    getJobs,
    getNextPrintJob,
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
    getUserJobs,  // <-- Added here
    getUserStats, // <-- Added here
    
    // Stats
    getStats,
    
    // Utility
    testConnection,
    closePool,
    query: (text, params) => pool.query(text, params),
    // Direct pool access (for custom queries)
    pool
};