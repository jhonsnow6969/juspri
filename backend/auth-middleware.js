// backend/auth-middleware.js - Firebase JWT Token Verification
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;
    
    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                                   './config/firebase-service-account.json';
        
        const serviceAccount = require(path.resolve(serviceAccountPath));
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        firebaseInitialized = true;
        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        console.error('   Make sure firebase-service-account.json exists in backend/config/');
        process.exit(1);
    }
}

/**
 * Middleware to verify Firebase JWT tokens
 * Protects routes by requiring authentication
 */
async function verifyToken(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ 
                error: 'No authorization header',
                message: 'Please provide an authentication token'
            });
        }
        
        // Check format: "Bearer <token>"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ 
                error: 'Invalid authorization format',
                message: 'Authorization header must be: Bearer <token>'
            });
        }
        
        const token = parts[1];
        
        if (!token) {
            return res.status(401).json({ 
                error: 'No token provided',
                message: 'Token is missing from authorization header'
            });
        }
        
        // Verify token with Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Attach user info to request object
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email.split('@')[0],
            email_verified: decodedToken.email_verified,
            picture: decodedToken.picture || null
        };
        
        // Continue to next middleware/route handler
        next();
        
    } catch (error) {
        console.error('Token verification error:', error.message);
        
        // Handle specific error types
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Your session has expired. Please login again.'
            });
        }
        
        if (error.code === 'auth/argument-error') {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'The authentication token is malformed or invalid.'
            });
        }
        
        return res.status(401).json({ 
            error: 'Authentication failed',
            message: 'Could not verify your identity. Please login again.'
        });
    }
}

/**
 * Optional middleware - allows both authenticated and unauthenticated requests
 * Adds user info if token is present, but doesn't reject if missing
 */
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email.split('@')[0]
        };
    } catch (error) {
        console.warn('Optional auth failed:', error.message);
        req.user = null;
    }
    
    next();
}

/**
 * Check if user is admin
 * In production, store admin UIDs in environment variables or database
 */
function isAdmin(req, res, next) {
    const adminUIDs = process.env.ADMIN_UIDS ? process.env.ADMIN_UIDS.split(',') : [];
    
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!adminUIDs.includes(req.user.uid)) {
        return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Admin access required'
        });
    }
    
    next();
}

/**
 * Get or create user in database
 * Call this after verifyToken to ensure user exists in database
 */
async function ensureUserExists(db, userInfo) {
    try {
        let user = await db.getUser(userInfo.uid);
        
        if (!user) {
            // User doesn't exist, create them
            user = await db.upsertUser({
                id: userInfo.uid,
                email: userInfo.email,
                name: userInfo.name
            });
            console.log(`✅ Created new user: ${userInfo.email}`);
        }
        
        return user;
    } catch (error) {
        console.error('Error ensuring user exists:', error);
        throw error;
    }
}

module.exports = {
    initializeFirebase,
    verifyToken,
    optionalAuth,
    isAdmin,
    ensureUserExists
};
