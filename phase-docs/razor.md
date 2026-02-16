Perfect! Let me create a **complete, production-ready Razorpay integration guide** for you to save and implement later! 🎯

---

# 💳 Complete Razorpay Integration Guide

**Version:** 1.0  
**Status:** Ready for Implementation  
**Time Required:** ~2-3 hours  

---

## 📋 Table of Contents

1. [Razorpay Account Setup](#1-razorpay-account-setup)
2. [Backend Integration](#2-backend-integration)
3. [Frontend Integration](#3-frontend-integration)
4. [Testing](#4-testing)
5. [Production Deployment](#5-production-deployment)
6. [Security Checklist](#6-security-checklist)

---

## 1. Razorpay Account Setup

### **Step 1.1: Create Razorpay Account**

```
1. Go to https://dashboard.razorpay.com/signup
2. Sign up with business email
3. Complete KYC verification (required for live mode)
4. Business verification takes 24-48 hours
```

### **Step 1.2: Get API Keys**

```
1. Login to dashboard: https://dashboard.razorpay.com/
2. Go to Settings → API Keys
3. Generate Test Keys (for development)
4. Generate Live Keys (for production, after KYC)

You'll get:
- Key ID (public, safe to expose)
- Key Secret (private, NEVER expose)
```

### **Step 1.3: Configure Webhooks (Important!)**

```
1. Go to Settings → Webhooks
2. Setup URL: https://your-backend.com/api/payments/webhook
3. Select events:
   - payment.authorized
   - payment.failed
   - payment.captured
4. Copy webhook secret (for verification)
```

---

## 2. Backend Integration

### **Step 2.1: Install Razorpay SDK**

```bash
cd backend
npm install razorpay crypto
```

### **Step 2.2: Update `.env` File**

**Add to `backend/.env`:**

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Use test credentials in development
# Switch to live (rzp_live_xxx) in production after KYC
```

### **Step 2.3: Create Razorpay Service**

**Create new file: `backend/services/razorpay.js`**

```javascript
// backend/services/razorpay.js
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create Razorpay order
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} jobId - Print job ID
 * @param {string} userId - User ID
 * @returns {Promise<object>} Razorpay order object
 */
async function createOrder(amount, jobId, userId) {
    try {
        // Convert amount to paise (Razorpay uses smallest currency unit)
        const amountInPaise = Math.round(amount * 100);
        
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `job_${jobId}`,
            notes: {
                job_id: jobId,
                user_id: userId,
                purpose: 'print_job'
            }
        };

        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error('Razorpay order creation failed:', error);
        throw new Error('Failed to create payment order');
    }
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} True if signature is valid
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
    try {
        const text = `${orderId}|${paymentId}`;
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(text)
            .digest('hex');

        return generated_signature === signature;
    } catch (error) {
        console.error('Signature verification failed:', error);
        return false;
    }
}

/**
 * Verify webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @returns {boolean} True if webhook is authentic
 */
function verifyWebhookSignature(body, signature) {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest('hex');

        return expectedSignature === signature;
    } catch (error) {
        console.error('Webhook verification failed:', error);
        return false;
    }
}

/**
 * Fetch payment details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} Payment details
 */
async function fetchPayment(paymentId) {
    try {
        return await razorpay.payments.fetch(paymentId);
    } catch (error) {
        console.error('Failed to fetch payment:', error);
        throw error;
    }
}

/**
 * Refund a payment
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to refund in paise (optional, full refund if not provided)
 * @returns {Promise<object>} Refund details
 */
async function refundPayment(paymentId, amount = null) {
    try {
        const options = amount ? { amount: Math.round(amount * 100) } : {};
        return await razorpay.payments.refund(paymentId, options);
    } catch (error) {
        console.error('Refund failed:', error);
        throw error;
    }
}

module.exports = {
    createOrder,
    verifyPaymentSignature,
    verifyWebhookSignature,
    fetchPayment,
    refundPayment
};
```

### **Step 2.4: Update Database Schema**

**Add to your database migration:**

```sql
-- Add payment tracking columns to jobs table
ALTER TABLE jobs ADD COLUMN razorpay_order_id VARCHAR(255);
ALTER TABLE jobs ADD COLUMN razorpay_payment_id VARCHAR(255);
ALTER TABLE jobs ADD COLUMN payment_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE jobs ADD COLUMN payment_amount DECIMAL(10, 2);
ALTER TABLE jobs ADD COLUMN payment_verified_at TIMESTAMP;

-- Create payments table for detailed tracking
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    razorpay_order_id VARCHAR(255) NOT NULL,
    razorpay_payment_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'CREATED',
    method VARCHAR(50),
    payment_captured BOOLEAN DEFAULT FALSE,
    error_code VARCHAR(255),
    error_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX idx_payments_job_id ON payments(job_id);
CREATE INDEX idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
```

### **Step 2.5: Update Backend Routes**

**Update `backend/index.js` - Replace payment endpoints:**

```javascript
// At the top, import Razorpay service
const razorpayService = require('./services/razorpay');

// ==================== PAYMENT ROUTES ====================

/**
 * Create Razorpay order
 * Called when user clicks "Pay" button
 */
app.post('/api/payments/create-order', verifyToken, async (req, res) => {
    try {
        const { job_id } = req.body;

        // Get job details
        const job = await db.getJobById(job_id);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Verify job belongs to user
        if (job.user_id !== req.user.uid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check if already paid
        if (job.status === 'PAID' || job.payment_status === 'CAPTURED') {
            return res.status(400).json({ error: 'Job already paid' });
        }

        // Create Razorpay order
        const order = await razorpayService.createOrder(
            job.total_cost,
            job_id,
            req.user.uid
        );

        // Save order details to database
        await db.updateJobPayment(job_id, {
            razorpay_order_id: order.id,
            payment_amount: job.total_cost,
            payment_status: 'CREATED'
        });

        // Also save to payments table
        await db.createPaymentRecord({
            job_id: job_id,
            user_id: req.user.uid,
            razorpay_order_id: order.id,
            amount: job.total_cost,
            status: 'CREATED'
        });

        res.json({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('[Payment Create Order] Error:', error);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
});

/**
 * Verify payment after Razorpay checkout
 * Called from frontend after successful payment
 */
app.post('/api/payments/verify', verifyToken, async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            job_id
        } = req.body;

        // Verify signature
        const isValid = razorpayService.verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            console.error('[Payment Verify] Invalid signature');
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // Fetch payment details from Razorpay
        const payment = await razorpayService.fetchPayment(razorpay_payment_id);

        // Update job status
        await db.updateJob(job_id, {
            status: 'PAID',
            payment_status: 'CAPTURED',
            razorpay_payment_id: razorpay_payment_id,
            payment_verified_at: new Date(),
            paid_at: new Date()
        });

        // Update payment record
        await db.updatePaymentRecord({
            razorpay_order_id: razorpay_order_id,
            razorpay_payment_id: razorpay_payment_id,
            status: 'CAPTURED',
            payment_captured: true,
            method: payment.method
        });

        console.log(`[Payment Verify] Job ${job_id} payment verified`);

        res.json({
            success: true,
            message: 'Payment verified successfully',
            job_id: job_id
        });
    } catch (error) {
        console.error('[Payment Verify] Error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

/**
 * Webhook endpoint for Razorpay events
 * IMPORTANT: This must handle raw body for signature verification
 */
app.post('/api/payments/webhook',
    express.raw({ type: 'application/json' }), // Raw body for signature
    async (req, res) => {
        try {
            const signature = req.headers['x-razorpay-signature'];
            
            // Verify webhook signature
            const isValid = razorpayService.verifyWebhookSignature(
                req.body.toString(),
                signature
            );

            if (!isValid) {
                console.error('[Webhook] Invalid signature');
                return res.status(400).json({ error: 'Invalid signature' });
            }

            const event = JSON.parse(req.body.toString());
            console.log(`[Webhook] Event: ${event.event}`);

            // Handle different event types
            switch (event.event) {
                case 'payment.authorized':
                    await handlePaymentAuthorized(event.payload.payment.entity);
                    break;

                case 'payment.captured':
                    await handlePaymentCaptured(event.payload.payment.entity);
                    break;

                case 'payment.failed':
                    await handlePaymentFailed(event.payload.payment.entity);
                    break;

                default:
                    console.log(`[Webhook] Unhandled event: ${event.event}`);
            }

            res.json({ status: 'ok' });
        } catch (error) {
            console.error('[Webhook] Error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    }
);

// Webhook handlers
async function handlePaymentAuthorized(payment) {
    console.log(`[Webhook] Payment authorized: ${payment.id}`);
    // Payment is authorized but not captured
    // You can auto-capture or wait for manual capture
}

async function handlePaymentCaptured(payment) {
    console.log(`[Webhook] Payment captured: ${payment.id}`);
    
    const jobId = payment.notes.job_id;
    
    if (jobId) {
        await db.updateJob(jobId, {
            status: 'PAID',
            payment_status: 'CAPTURED',
            razorpay_payment_id: payment.id
        });
    }
}

async function handlePaymentFailed(payment) {
    console.log(`[Webhook] Payment failed: ${payment.id}`);
    
    const jobId = payment.notes.job_id;
    
    if (jobId) {
        await db.updateJob(jobId, {
            payment_status: 'FAILED'
        });
        
        await db.updatePaymentRecord({
            razorpay_payment_id: payment.id,
            status: 'FAILED',
            error_code: payment.error_code,
            error_description: payment.error_description
        });
    }
}
```

### **Step 2.6: Add Database Helper Functions**

**Add to `backend/db.js`:**

```javascript
// Update job payment details
async function updateJobPayment(jobId, paymentData) {
    const query = `
        UPDATE jobs 
        SET razorpay_order_id = $1,
            payment_amount = $2,
            payment_status = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
    `;
    
    const result = await pool.query(query, [
        paymentData.razorpay_order_id,
        paymentData.payment_amount,
        paymentData.payment_status,
        jobId
    ]);
    
    return result.rows[0];
}

// Create payment record
async function createPaymentRecord(data) {
    const query = `
        INSERT INTO payments (
            job_id, user_id, razorpay_order_id,
            amount, status
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const result = await pool.query(query, [
        data.job_id,
        data.user_id,
        data.razorpay_order_id,
        data.amount,
        data.status
    ]);
    
    return result.rows[0];
}

// Update payment record
async function updatePaymentRecord(data) {
    const query = `
        UPDATE payments
        SET razorpay_payment_id = $1,
            status = $2,
            payment_captured = $3,
            method = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE razorpay_order_id = $5
        RETURNING *
    `;
    
    const result = await pool.query(query, [
        data.razorpay_payment_id,
        data.status,
        data.payment_captured || false,
        data.method || null,
        data.razorpay_order_id
    ]);
    
    return result.rows[0];
}

module.exports = {
    // ... existing exports
    updateJobPayment,
    createPaymentRecord,
    updatePaymentRecord
};
```

---

## 3. Frontend Integration

### **Step 3.1: Add Razorpay Script**

**Update `frontend/index.html`:**

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DirectPrint</title>
    
    <!-- Razorpay Checkout Script -->
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  </head>
  <body class="dark">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### **Step 3.2: Update Payment Handler in App.jsx**

**In `src/App.jsx`, replace the `handlePayment` function:**

```javascript
const handlePayment = useCallback(async () => {
    if (!pricing?.job_id) return;
    
    setStatus('PROCESSING_PAYMENT');
    addLog('Initiating payment...');

    try {
        const authHeader = await getAuthHeader();
        
        // Step 1: Create Razorpay order
        const orderResponse = await axios.post(
            `${API_URL}/api/payments/create-order`,
            { job_id: pricing.job_id },
            { headers: { 'Authorization': authHeader } }
        );

        const { order_id, amount, currency, key_id } = orderResponse.data;
        
        addLog('Payment gateway opened');

        // Step 2: Open Razorpay Checkout
        const options = {
            key: key_id,
            amount: amount,
            currency: currency,
            name: 'DirectPrint',
            description: `Print Job - ${pricing.pages} pages`,
            order_id: order_id,
            prefill: {
                name: user?.displayName || '',
                email: user?.email || '',
            },
            theme: {
                color: '#3b82f6'
            },
            handler: async function (response) {
                // Step 3: Verify payment on backend
                try {
                    addLog('Verifying payment...');
                    
                    await axios.post(
                        `${API_URL}/api/payments/verify`,
                        {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            job_id: pricing.job_id
                        },
                        { headers: { 'Authorization': authHeader } }
                    );

                    addLog('✓ Payment verified!');
                    addLog('Job sent to printer');
                    setStatus('PRINTING');
                } catch (verifyError) {
                    console.error('Payment verification failed:', verifyError);
                    setStatus('ERROR');
                    addLog('✗ Payment verification failed');
                }
            },
            modal: {
                ondismiss: function() {
                    setStatus('PAYMENT');
                    addLog('Payment cancelled');
                }
            }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();

    } catch (error) {
        console.error('Payment initiation failed:', error);
        setStatus('ERROR');
        addLog(`✗ Payment failed: ${error.response?.data?.error || error.message}`);
    }
}, [pricing, API_URL, addLog, getAuthHeader, user, setStatus]);
```

### **Step 3.3: Add New Payment Processing State**

**In `App.jsx`, add this new view after PAYMENT view:**

```jsx
{/* VIEW 4.5: Processing Payment */}
{status === 'PROCESSING_PAYMENT' && (
    <div className="space-y-6 text-center py-8">
        <div className="relative">
            <Loader2 className="animate-spin h-16 w-16 mx-auto text-white"/>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-20 w-20 bg-white/10 rounded-full blur-xl"></div>
            </div>
        </div>
        <div>
            <p className="text-xl font-semibold mb-2 text-foreground">Processing Payment...</p>
            <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
    </div>
)}
```

---

## 4. Testing

### **Step 4.1: Test Card Details**

Razorpay provides test cards for different scenarios:

```
✅ Successful Payment:
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date
Name: Any name

❌ Failed Payment:
Card Number: 4000 0000 0000 0002
CVV: Any 3 digits

⏸️ Payment Pending:
Card Number: 4000 0000 0000 0077
```

### **Step 4.2: Testing Flow**

```
1. Start development servers:
   - Backend: node index.js
   - Frontend: npm run dev

2. Test complete flow:
   ✓ Scan QR/Connect to kiosk
   ✓ Upload document
   ✓ See pricing
   ✓ Click "Pay & Print"
   ✓ Razorpay checkout opens
   ✓ Enter test card: 4111 1111 1111 1111
   ✓ Payment succeeds
   ✓ Status changes to PRINTING
   ✓ Document prints

3. Test failure:
   ✓ Use card: 4000 0000 0000 0002
   ✓ Payment fails
   ✓ Status goes back to PAYMENT
   ✓ Job status remains PENDING
```

### **Step 4.3: Test Webhooks Locally**

Use **ngrok** to test webhooks:

```bash
# Install ngrok
npm install -g ngrok

# Expose local backend
ngrok http 3001

# Update Razorpay webhook URL to:
https://xxxxx.ngrok.io/api/payments/webhook

# Test payment and check webhook logs
```

---

## 5. Production Deployment

### **Step 5.1: Switch to Live Keys**

**Update `backend/.env` for production:**

```env
# Production Razorpay Keys
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_live_secret_key
RAZORPAY_WEBHOOK_SECRET=whsec_live_xxxxxxxxx
```

### **Step 5.2: Update Webhook URL**

```
1. Go to Razorpay Dashboard → Settings → Webhooks
2. Update URL to: https://justpri.duckdns.org/api/payments/webhook
3. Enable events:
   - payment.authorized
   - payment.captured
   - payment.failed
4. Save webhook secret
```

### **Step 5.3: SSL Certificate Required**

```
✅ Your backend must have HTTPS
✅ Use Let's Encrypt (already configured in Oracle VM guide)
✅ Razorpay requires valid SSL for webhooks
```

---

## 6. Security Checklist

### **✅ Must-Do Security Measures:**

1. **Environment Variables:**
   - ✅ Never commit `.env` file
   - ✅ Use separate test/live keys
   - ✅ Rotate keys regularly

2. **Signature Verification:**
   - ✅ Always verify payment signature
   - ✅ Verify webhook signatures
   - ✅ Never trust frontend data alone

3. **Database Security:**
   - ✅ Store payment IDs, not card details
   - ✅ Index payment tables for performance
   - ✅ Log all payment attempts

4. **Backend Validation:**
   - ✅ Verify user owns the job
   - ✅ Check job not already paid
   - ✅ Validate amounts match

5. **Error Handling:**
   - ✅ Log all payment errors
   - ✅ Don't expose sensitive errors to frontend
   - ✅ Monitor webhook failures

6. **Webhook Protection:**
   - ✅ Use raw body parser for webhooks
   - ✅ Verify signature on every webhook
   - ✅ Handle webhook retries properly

---

## 📊 Summary Checklist

**Before Going Live:**

```
Backend:
✅ Razorpay service created
✅ Payment routes implemented
✅ Database schema updated
✅ Webhook endpoint configured
✅ Signature verification working
✅ Error logging enabled

Frontend:
✅ Razorpay script loaded
✅ Payment handler updated
✅ UI shows payment status
✅ Error messages displayed

Testing:
✅ Tested with test cards
✅ Verified payment flow end-to-end
✅ Webhooks tested locally
✅ Failed payments handled

Production:
✅ KYC completed
✅ Live keys configured
✅ Webhook URL updated to production
✅ SSL certificate valid
✅ Monitoring enabled
```

---

## 💡 Pro Tips

1. **Webhook Reliability:**
   - Razorpay retries webhooks up to 3 times
   - Your endpoint must respond with 200 within 10 seconds
   - Implement idempotency to handle duplicate webhooks

2. **Payment States:**
   ```
   CREATED → User hasn't paid yet
   AUTHORIZED → Payment approved, not captured
   CAPTURED → Money received (final state)
   FAILED → Payment declined
   ```

3. **Auto-Capture:**
   - By default, Razorpay auto-captures after 15 minutes
   - You can change this in dashboard settings
   - For print kiosks, auto-capture is recommended

4. **Refunds:**
   - Available via Razorpay dashboard
   - Can be automated using API
   - Instant refunds to cards (3-5 days for bank transfer)

---

