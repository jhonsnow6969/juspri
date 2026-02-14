# Phase 4: Pull-Based Authorization Model - Complete Guide

## 🎯 Goal
Change from push-based (server pushes jobs to Pi) to pull-based (Pi polls for authorized jobs). This improves security, creates better audit trails, and gives you more control over job execution.

## 📋 What's Changing

### Current (Push-Based):
```
User pays → Server immediately pushes job to Pi via Socket.IO → Pi prints
```
**Problems:**
- Pi must maintain persistent Socket.IO connection
- Server decides when to print
- Harder to audit job authorization
- Pi could receive jobs it's not ready for

### New (Pull-Based):
```
User pays → Job marked as PAID in database → Pi polls for PAID jobs → Pi executes
```
**Benefits:**
- ✅ Pi controls when to fetch jobs
- ✅ Clear separation: authorization (cloud) vs execution (edge)
- ✅ Better audit trail (all state changes in database)
- ✅ Pi can check readiness before fetching
- ✅ More resilient to network issues

## 🏗️ Architecture Changes

### Backend Changes:
1. **Remove:** `sendJobToPi()` function that pushes via Socket.IO
2. **Add:** `GET /api/jobs/poll` endpoint for Pi to fetch authorized jobs
3. **Keep:** Socket.IO for real-time status updates to frontend (not for job delivery)

### Pi Agent Changes:
1. **Add:** Polling loop that checks for new PAID jobs every 5-10 seconds
2. **Remove:** Immediate job execution on Socket.IO `new_job` event
3. **Keep:** Socket.IO for heartbeat and status reporting

### Database:
No schema changes needed! The existing `status` field already supports this:
- `PENDING` → Job created, waiting for payment
- `PAID` → Payment verified, ready for printing
- `QUEUED` → Pi has fetched the job
- `PRINTING` → Pi is printing
- `COMPLETED` → Done

## ⚡ Implementation Steps

### Step 1: Update Backend API

Add a new polling endpoint that Pi can call to fetch authorized jobs.

**Key Features:**
- Returns jobs with status = 'PAID' for a specific kiosk
- Includes file data (base64 encoded or sends file path)
- Marks job as 'QUEUED' once Pi fetches it
- Respects queue order (oldest first)

### Step 2: Update Pi Agent

Add polling mechanism:
- Every 5-10 seconds, call `GET /api/jobs/poll?kiosk_id=xxx`
- If jobs available, fetch and queue them locally
- Execute jobs in order

### Step 3: Keep Socket.IO for Status

Socket.IO still useful for:
- Real-time status updates (job started, completed, failed)
- Heartbeat/health monitoring
- Kiosk online/offline status
- Immediate notification to frontend (optional)

## 🚀 Implementation

### Backend: New Polling Endpoint

```javascript
// Add to backend/index.js

// Pi polls for authorized jobs
app.get('/api/jobs/poll', async (req, res) => {
  const { kiosk_id } = req.query;
  
  if (!kiosk_id) {
    return res.status(400).json({ error: 'kiosk_id required' });
  }
  
  try {
    // Get oldest PAID job for this kiosk
    const jobs = await db.getJobs({ 
      kiosk_id: kiosk_id, 
      status: 'PAID',
      limit: 1 
    });
    
    if (jobs.length === 0) {
      return res.json({ jobs: [] });
    }
    
    const job = jobs[0];
    
    // Mark as QUEUED (Pi has fetched it)
    await db.updateJob(job.id, { 
      status: 'QUEUED',
      queued_at: new Date()
    });
    
    // Read file and send as base64
    const fileData = fs.readFileSync(job.file_path);
    const fileBase64 = fileData.toString('base64');
    
    res.json({
      jobs: [{
        job_id: job.id,
        filename: job.filename,
        pages: job.pages,
        file_data: fileBase64,
        user_id: job.user_id,
        created_at: job.created_at
      }]
    });
    
    console.log(`[Poll] Job ${job.id} fetched by kiosk ${kiosk_id}`);
    
  } catch (error) {
    console.error('[Poll] Error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});
```

### Pi Agent: Add Polling Loop

```javascript
// In pi-agent/index.js

// Polling configuration
const POLL_INTERVAL = 5000; // 5 seconds

// Poll for new jobs
async function pollForJobs() {
  if (!socket.connected) {
    console.log('⚠ Not connected to cloud, skipping poll');
    return;
  }
  
  try {
    const response = await axios.get(`${CLOUD_SERVER}/api/jobs/poll`, {
      params: { kiosk_id: KIOSK_ID },
      timeout: 10000
    });
    
    if (response.data.jobs && response.data.jobs.length > 0) {
      for (const job of response.data.jobs) {
        console.log(`[Poll] New job received: ${job.job_id}`);
        await handlePolledJob(job);
      }
    }
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error('[Poll] Error:', error.message);
    }
  }
}

async function handlePolledJob(job) {
  const { job_id, filename, pages, file_data } = job;
  
  // Save file locally
  const tempFile = path.join(TEMP_DIR, `${job_id}_${filename}`);
  const fileBuffer = Buffer.from(file_data, 'base64');
  fs.writeFileSync(tempFile, fileBuffer);
  
  console.log(`   ✓ File saved: ${filename} (${pages} pages)`);
  
  // Add to local queue
  pendingJobs.set(job_id, {
    job_id,
    filename,
    pages,
    filePath: tempFile,
    receivedAt: new Date()
  });
  
  // Execute immediately if not printing
  if (!currentJob) {
    executePrint(job_id);
  }
}

// Start polling
setInterval(pollForJobs, POLL_INTERVAL);
console.log(`🔄 Polling enabled (every ${POLL_INTERVAL/1000}s)`);
```

## 🔄 Updated Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER WORKFLOW                            │
└─────────────────────────────────────────────────────────────┘

1. User uploads file
   └→ Backend creates job (status: PENDING)

2. User pays
   └→ Backend verifies payment
   └→ Job status → PAID
   └→ Job sits in database waiting

3. Pi polls every 5 seconds
   └→ GET /api/jobs/poll?kiosk_id=xxx
   └→ Backend returns PAID jobs
   └→ Backend marks job as QUEUED

4. Pi downloads file and prints
   └→ Pi reports status: PRINTING
   └→ Pi reports status: COMPLETED

5. Frontend gets real-time updates via Socket.IO (optional)
```

## 🎯 Benefits of Pull Model

### Security
- ✅ Pi only executes explicitly authorized jobs
- ✅ Clear audit trail: every state change is logged
- ✅ No risk of unauthorized push

### Resilience
- ✅ Pi can be offline temporarily
- ✅ Jobs queue up in database
- ✅ Pi catches up when back online

### Scalability
- ✅ Multiple Pis can poll same backend
- ✅ Load balancing via database
- ✅ Easy to add job priorities

### Debugging
- ✅ Easy to see job state at any point
- ✅ Can manually mark jobs as PAID for testing
- ✅ Clear logs of who did what when

## 🔧 Configuration

### Backend `.env`
```bash
# No new config needed!
# Existing settings work fine
```

### Pi Agent `.env`
```bash
# Add polling configuration
POLL_INTERVAL=5000  # Poll every 5 seconds

# Optional: Max jobs to fetch per poll
MAX_JOBS_PER_POLL=1
```

## 🧪 Testing

### Test 1: Create and Pay for Job
```bash
# Via frontend or curl
curl -X POST http://localhost:3001/api/jobs/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "kiosk_id=test_kiosk"

# Note the job_id, then verify payment
curl -X POST http://localhost:3001/api/jobs/JOB_ID/verify-payment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"test"}'
```

### Test 2: Check Database
```sql
-- Job should be marked as PAID
SELECT id, status, paid_at FROM jobs WHERE status = 'PAID';
```

### Test 3: Pi Should Poll and Print
```bash
# Watch Pi agent logs
# Should see:
# [Poll] New job received: job_xxx
# ✓ File saved: test.pdf (1 pages)
# 🖨️ Printing Job job_xxx
```

### Test 4: Manual Poll Test
```bash
# Manually call poll endpoint
curl "http://localhost:3001/api/jobs/poll?kiosk_id=test_kiosk"

# Should return job(s) if any are PAID
```

## 🚨 Troubleshooting

### Pi Not Fetching Jobs

**Check 1: Is polling enabled?**
```javascript
// In pi-agent logs, should see:
// 🔄 Polling enabled (every 5s)
```

**Check 2: Is Pi connected?**
```javascript
// Should see:
// ✓ Connected to Cloud Hub!
```

**Check 3: Are there PAID jobs?**
```sql
SELECT id, kiosk_id, status FROM jobs WHERE status = 'PAID';
```

**Check 4: Check poll endpoint**
```bash
# Manually test
curl "http://localhost:3001/api/jobs/poll?kiosk_id=YOUR_KIOSK_ID"
```

### Jobs Stuck in PAID Status

**Problem:** Jobs marked as PAID but never fetched

**Solutions:**
1. Check Pi agent is running
2. Check KIOSK_ID matches
3. Check network connectivity
4. Check backend logs for errors

### Duplicate Job Execution

**Problem:** Same job printed twice

**Cause:** Race condition in polling

**Solution:** Add locking mechanism:
```javascript
let isPolling = false;

async function pollForJobs() {
  if (isPolling) return; // Skip if already polling
  
  isPolling = true;
  try {
    // ... polling logic
  } finally {
    isPolling = false;
  }
}
```

## 📊 Monitoring

### Backend Dashboard Query
```sql
-- Jobs by status
SELECT status, COUNT(*) as count 
FROM jobs 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY status;

-- Average time from PAID to COMPLETED
SELECT AVG(EXTRACT(EPOCH FROM (print_completed_at - paid_at))) as avg_seconds
FROM jobs 
WHERE status = 'COMPLETED'
AND print_completed_at IS NOT NULL
AND paid_at IS NOT NULL;
```

### Pi Agent Metrics
```javascript
// Add to heartbeat
socket.emit('heartbeat', {
  kiosk_id: KIOSK_ID,
  uptime: process.uptime(),
  last_poll: lastPollTime,
  jobs_fetched_today: jobsFetchedToday,
  current_job: currentJob
});
```

## 🎛️ Advanced: Job Priorities

Want to prioritize certain jobs? Easy with pull model:

```javascript
// Backend: Get highest priority PAID jobs first
const jobs = await db.pool.query(`
  SELECT * FROM jobs 
  WHERE kiosk_id = $1 AND status = 'PAID'
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
`, [kiosk_id]);
```

## 🔄 Migration Path

### Option A: Big Bang (Recommended)
1. Update backend with poll endpoint
2. Update Pi agent with polling
3. Deploy both at same time
4. Remove old push code

### Option B: Gradual
1. Add poll endpoint (keep push)
2. Update Pi to use polling
3. Monitor for 24 hours
4. Remove push code once confident

## ✅ Success Checklist

- [ ] Backend has `/api/jobs/poll` endpoint
- [ ] Pi agent polls every 5 seconds
- [ ] Jobs transition: PENDING → PAID → QUEUED → PRINTING → COMPLETED
- [ ] Pi only executes PAID jobs
- [ ] Can see polling in Pi logs
- [ ] Jobs don't get lost if Pi restarts
- [ ] Multiple jobs queue properly
- [ ] Frontend still gets real-time updates

## 🚀 What's Next

After Phase 4:
- ✅ Pull-based authorization working
- ✅ Better security and audit trail
- ✅ More resilient system

**Phase 5:** Document Conversion (DOCX, images, etc.)
**Phase 6:** Bluetooth File Transfer (optional)
**Phase 7:** Razorpay Integration (last)

---

**Ready to implement?** This is a cleaner architecture that gives you more control! 🎯
