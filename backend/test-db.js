// backend/test-db.js - Comprehensive Database Test
require('dotenv').config();
const db = require('../db');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(color, symbol, message) {
    console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function runTests() {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Database Connection & Operations Test        ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    // Test 1: Connection
    console.log('Test 1: Database Connection');
    try {
        const connected = await db.testConnection();
        if (connected) {
            log(colors.green, '✓', 'Database connection successful');
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Database connection failed');
            testsFailed++;
            return;
        }
    } catch (error) {
        log(colors.red, '✗', `Connection error: ${error.message}`);
        testsFailed++;
        return;
    }
    
    // Test 2: Create User
    console.log('\nTest 2: Create User');
    try {
        const testUser = await db.upsertUser({
            id: 'test_user_123',
            email: 'test@example.com',
            name: 'Test User'
        });
        
        if (testUser && testUser.id === 'test_user_123') {
            log(colors.green, '✓', `User created: ${testUser.email}`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'User creation failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `User creation error: ${error.message}`);
        testsFailed++;
    }
    
    // Test 3: Create Kiosk
    console.log('\nTest 3: Create Kiosk');
    try {
        const testKiosk = await db.upsertKiosk({
            id: 'kiosk_test_001',
            hostname: 'test-pi',
            printer_name: 'HP_LaserJet',
            status: 'online',
            socket_id: 'socket_123'
        });
        
        if (testKiosk && testKiosk.id === 'kiosk_test_001') {
            log(colors.green, '✓', `Kiosk created: ${testKiosk.hostname}`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Kiosk creation failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `Kiosk creation error: ${error.message}`);
        testsFailed++;
    }
    
    // Test 4: Create Job
    console.log('\nTest 4: Create Job');
    try {
        const testJob = await db.createJob({
            id: 'job_test_001',
            user_id: 'test_user_123',
            kiosk_id: 'kiosk_test_001',
            filename: 'test.pdf',
            file_path: '/tmp/test.pdf',
            file_size: 1024,
            pages: 5,
            price_per_page: 3,
            total_cost: 15,
            status: 'PENDING',
            payment_status: 'pending'
        });
        
        if (testJob && testJob.id === 'job_test_001') {
            log(colors.green, '✓', `Job created: ${testJob.filename} (${testJob.pages} pages, ₹${testJob.total_cost})`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Job creation failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `Job creation error: ${error.message}`);
        testsFailed++;
    }
    
    // Test 5: Get Job
    console.log('\nTest 5: Retrieve Job');
    try {
        const job = await db.getJob('job_test_001');
        
        if (job && job.id === 'job_test_001') {
            log(colors.green, '✓', `Job retrieved: ${job.filename}`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Job retrieval failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `Job retrieval error: ${error.message}`);
        testsFailed++;
    }
    
    // Test 6: Update Job
    console.log('\nTest 6: Update Job Status');
    try {
        const updatedJob = await db.updateJob('job_test_001', {
            status: 'PAID',
            payment_status: 'paid',
            paid_at: new Date()
        });
        
        if (updatedJob && updatedJob.status === 'PAID') {
            log(colors.green, '✓', `Job updated: status = ${updatedJob.status}`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Job update failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `Job update error: ${error.message}`);
        testsFailed++;
    }
    
    // Test 7: Get Jobs with Filter
    console.log('\nTest 7: Query Jobs by Status');
    try {
        const paidJobs = await db.getJobs({ status: 'PAID' });
        
        if (paidJobs && paidJobs.length > 0) {
            log(colors.green, '✓', `Found ${paidJobs.length} PAID job(s)`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Job query failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `Job query error: ${error.message}`);
        testsFailed++;
    }
    
    // Test 8: Update Kiosk Status
    console.log('\nTest 8: Update Kiosk Status');
    try {
        const updatedKiosk = await db.updateKioskStatus('kiosk_test_001', 'offline');
        
        if (updatedKiosk && updatedKiosk.status === 'offline') {
            log(colors.green, '✓', `Kiosk status updated: ${updatedKiosk.status}`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Kiosk update failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `Kiosk update error: ${error.message}`);
        testsFailed++;
    }
    
    // Test 9: Get Statistics
    console.log('\nTest 9: Get System Statistics');
    try {
        const stats = await db.getStats();
        
        if (stats && typeof stats.totalJobs === 'number') {
            log(colors.green, '✓', 'Statistics retrieved:');
            console.log(`   Total Jobs: ${stats.totalJobs}`);
            console.log(`   Pending: ${stats.pendingJobs}`);
            console.log(`   Completed: ${stats.completedJobs}`);
            console.log(`   Online Kiosks: ${stats.onlineKiosks}`);
            console.log(`   Total Revenue: ₹${stats.totalRevenue}`);
            testsPassed++;
        } else {
            log(colors.red, '✗', 'Statistics retrieval failed');
            testsFailed++;
        }
    } catch (error) {
        log(colors.red, '✗', `Statistics error: ${error.message}`);
        testsFailed++;
    }
    
    // Cleanup Test Data
    console.log('\nTest 10: Cleanup Test Data');
    try {
        await db.pool.query('DELETE FROM jobs WHERE id LIKE \'job_test_%\'');
        await db.pool.query('DELETE FROM kiosks WHERE id LIKE \'kiosk_test_%\'');
        await db.pool.query('DELETE FROM users WHERE id LIKE \'test_user_%\'');
        log(colors.green, '✓', 'Test data cleaned up');
        testsPassed++;
    } catch (error) {
        log(colors.yellow, '⚠', `Cleanup warning: ${error.message}`);
    }
    
    // Summary
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Test Summary                                  ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    
    const total = testsPassed + testsFailed;
    console.log(`Total Tests: ${total}`);
    log(colors.green, '✓', `Passed: ${testsPassed}`);
    
    if (testsFailed > 0) {
        log(colors.red, '✗', `Failed: ${testsFailed}`);
    }
    
    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed! Database is ready to use.\n');
    } else {
        console.log('\n❌ Some tests failed. Please check your database configuration.\n');
    }
    
    // Close database connection
    await db.closePool();
    process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
