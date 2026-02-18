// backend/index.js - V5 Modular Refactor
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const multer = require('multer');

const db = require('./db');
const { initializeFirebase } = require('./auth-middleware');

// Module Imports
const jobRoutes = require('./modules/job-routes');
const adminRoutes = require('./modules/admin-routes');
const { initSocketServer } = require('./modules/socket-manager');
const { startScheduledTasks } = require('./modules/tasks');
const kioskRoutes = require('./modules/kiosk-routes'); 
const app = express();
const server = http.createServer(app);

// Make db accessible to routes
app.set('db', db);

initializeFirebase();

// ==================== CORS ====================
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'https://qr-wifi-printer.vercel.app',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'https://justpri.duckdns.org'
    ];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.warn('CORS blocked:', origin);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// ==================== SOCKET.IO ====================
const io = new Server(server, { 
    cors: { 
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    } 
});

initSocketServer(io);

// ==================== ROUTES ====================
app.use('/api', jobRoutes);
app.use('/api', adminRoutes);
app.use('/api/kiosk', kioskRoutes);
// Global Error Handler for Multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        message: 'Maximum file size is 50MB' 
      });
    }
    return res.status(400).json({ error: error.message });
  } else if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

// ==================== SCHEDULED TASKS ====================
startScheduledTasks();

// ==================== STARTUP ====================
const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        const dbConnected = await db.testConnection();
        
        if (!dbConnected) {
            console.error('❌ Database connection failed. Please check your configuration.');
            process.exit(1);
        }
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔═══════════════════════════════════════════╗
║   DirectPrint Server V5 (Modular)         ║
║   Database: PostgreSQL ✅                 ║
║   Auth: Firebase ✅                       ║
║   Model: Pull-Based ✅                    ║
║   Port: ${PORT}                             ║
╚═══════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down server...');
    try {
        await db.closePool();
        console.log('✅ Database connections closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM...');
    await db.closePool();
    process.exit(0);
});

startServer();