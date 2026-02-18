// backend/middleware/admin-auth.js
// Admin authorization middleware for protected admin routes

const db = require('../db');

/**
 * Middleware: Require Admin Role
 * 
 * Must be used AFTER verifyToken middleware
 * Checks if authenticated user has 'admin' or 'superadmin' role
 * 
 * Usage:
 *   router.get('/admin/metrics', verifyToken, requireAdmin, (req, res) => {...})
 */
async function requireAdmin(req, res, next) {
    try {
        // Check if user is authenticated (verifyToken should run first)
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'Authentication required' 
            });
        }

        // Query user role from database
        const user = await db.getUser(req.user.uid);

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Your account was not found in the database'
            });
        }

        if (user.role !== 'admin' && user.role !== 'superadmin') {
            console.warn(`[Admin Auth] Access denied for user: ${user.email} (role: ${user.role})`);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Admin access required. Contact support if you believe this is an error.'
            });
        }

        req.adminUser = user;
        
        next();

    } catch (error) {
        console.error('[Admin Auth] Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to verify admin status' 
        });
    }
}

/**
 * Optional: Log admin action to audit trail
 * Call this from admin route handlers to track sensitive actions
 * 
 * Usage:
 *   await logAdminAction(req.adminUser.id, 'RESET_PAPER', 'kiosk', 'kiosk_1', { old: 50, new: 500 });
 */
async function logAdminAction(adminId, actionType, targetType, targetId, details) {
    try {
        await db.query(
            `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [adminId, actionType, targetType, targetId, JSON.stringify(details)]
        );
    } catch (error) {
        console.error('[Admin Action Log] Failed:', error);
        // Don't throw - logging failure shouldn't break the main action
    }
}

module.exports = {
    requireAdmin,
    logAdminAction
};
