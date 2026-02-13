# Razorpay Payment Integration Guide 💳

This guide shows how to integrate Razorpay when you're ready to enable real payments.

## Prerequisites

1. **Razorpay Account**: Sign up at https://razorpay.com
2. **Get API Keys**:
   - Dashboard → Settings → API Keys
   - Note down: `Key ID` and `Key Secret`

## Installation

### Backend
```bash
cd backend
npm install razorpay
```

### Frontend
```bash
cd frontend
npm install react-razorpay
```

## Backend Implementation

### 1. Update `backend/index.js`

```javascript
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order endpoint
app.post('/api/create-order', async (req, res) => {
  const { amount, currency = 'INR' } = req.body; // amount in paise (₹15 = 1500)
  
  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert rupees to paise
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        purpose: 'DirectPrint Payment'
      }
    });
    
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID // Send to frontend
    });
  } catch (error) {
    console.error('Order creation failed:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify payment endpoint
app.post('/api/verify-payment', (req, res) => {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature 
  } = req.body;
  
  const crypto = require('crypto');
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  
  const isValid = expectedSignature === razorpay_signature;
  
  if (isValid) {
    res.json({ 
      status: 'success', 
      message: 'Payment verified',
      paymentId: razorpay_payment_id
    });
  } else {
    res.status(400).json({ 
      status: 'failed', 
      message: 'Invalid signature' 
    });
  }
});
```

### 2. Add to `backend/.env`
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxx
```

## Frontend Implementation

### 1. Install Razorpay Script

Add to `frontend/index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### 2. Update `frontend/src/App.jsx`

Replace the mock `handlePayment` function:

```javascript
const handlePayment = async () => {
  try {
    addLog(`Creating payment order for ₹${pricing.totalPrice}...`);
    
    // Step 1: Create Razorpay order on backend
    const orderResponse = await axios.post(`${API_URL}/api/create-order`, {
      amount: pricing.totalPrice,
      currency: 'INR'
    });
    
    const { orderId, amount, currency, key } = orderResponse.data;
    
    // Step 2: Open Razorpay Checkout
    const options = {
      key: key, // Razorpay Key ID
      amount: amount, // Amount in paise
      currency: currency,
      name: 'DirectPrint',
      description: `Print ${pricing.pages} page(s)`,
      order_id: orderId,
      handler: async function (response) {
        // Step 3: Verify payment on backend
        try {
          const verifyResponse = await axios.post(`${API_URL}/api/verify-payment`, {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
          
          if (verifyResponse.data.status === 'success') {
            addLog(`✅ Payment verified: ${response.razorpay_payment_id}`);
            setStatus('PRINTING');
            executePrint();
          }
        } catch (error) {
          addLog('❌ Payment verification failed');
          alert('Payment verification failed. Please contact support.');
        }
      },
      prefill: {
        name: '',
        email: '',
        contact: ''
      },
      theme: {
        color: '#3B82F6' // Blue theme
      },
      modal: {
        ondismiss: function() {
          addLog('Payment cancelled by user');
          setStatus('PAYMENT');
        }
      }
    };
    
    const razorpayInstance = new window.Razorpay(options);
    razorpayInstance.open();
    
  } catch (error) {
    console.error('Payment error:', error);
    addLog('Payment initialization failed');
    alert('Could not start payment. Try again.');
  }
};
```

## Payment Flow

```
User clicks "Pay & Print"
        ↓
Frontend → Backend: Create order
        ↓
Backend → Razorpay: Create order API
        ↓
Razorpay returns order_id
        ↓
Frontend opens Razorpay Checkout modal
        ↓
User completes payment (UPI/Card/Netbanking)
        ↓
Razorpay returns payment details
        ↓
Frontend → Backend: Verify payment signature
        ↓
Backend validates signature with secret
        ↓
If valid → Execute print job
If invalid → Show error, refund if needed
```

## Testing

### Test Mode Keys
Razorpay provides test keys that don't charge real money:
- Key ID: `rzp_test_xxxxxxxxxxxxxx`
- Test cards: https://razorpay.com/docs/payments/payments/test-card-details/

### Test Card Numbers
```
Success: 4111 1111 1111 1111
Failure: 4000 0000 0000 0002
CVV: Any 3 digits
Expiry: Any future date
```

### Test UPI
Use any UPI ID in test mode - it will simulate success.

## Production Checklist

- [ ] Replace test keys with live keys
- [ ] Enable HTTPS on backend
- [ ] Add webhook for payment status updates
- [ ] Implement refund logic for failed prints
- [ ] Add payment receipt generation
- [ ] Store payment records in database
- [ ] Add GST calculation if applicable
- [ ] Test with real small amounts first

## Webhook Setup (Optional but Recommended)

Razorpay can notify your backend about payment events:

```javascript
// backend/index.js
app.post('/api/webhook', (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  const crypto = require('crypto');
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');
  
  if (digest === req.headers['x-razorpay-signature']) {
    // Valid webhook
    const event = req.body.event;
    
    if (event === 'payment.captured') {
      console.log('Payment captured:', req.body.payload.payment.entity);
      // Update your database, send confirmation email, etc.
    }
    
    res.json({ status: 'ok' });
  } else {
    res.status(403).json({ error: 'Invalid signature' });
  }
});
```

Configure webhook URL in Razorpay Dashboard:
`https://your-backend.com/api/webhook`

## Security Best Practices

1. **Never expose secret key** to frontend
2. **Always verify signatures** on backend
3. **Use HTTPS** in production
4. **Validate amount** on backend before creating order
5. **Log all transactions** for audit trail
6. **Handle edge cases**:
   - Payment success but print fails → Refund
   - User closes modal → No charge
   - Network timeout → Check payment status

## Pricing Model

Current: ₹3 per page

You can modify pricing logic in backend:

```javascript
// Dynamic pricing based on page count
function calculatePrice(pages) {
  if (pages <= 5) return pages * 3;
  if (pages <= 20) return pages * 2.5; // Bulk discount
  return pages * 2; // Larger bulk discount
}
```

## Alternative Payment Methods

### 1. **Stripe** (International)
Similar flow, supports global cards
```bash
npm install stripe
```

### 2. **PayTM** (India)
```bash
npm install paytmchecksum
```

### 3. **PhonePe** (India, UPI focused)
REST API based integration

### 4. **Cash Free** (India)
Similar to Razorpay

## Refund Implementation

```javascript
// backend/index.js
app.post('/api/refund', async (req, res) => {
  const { paymentId, amount } = req.body;
  
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100, // Paise
      notes: {
        reason: 'Print job failed'
      }
    });
    
    res.json({ status: 'success', refundId: refund.id });
  } catch (error) {
    res.status(500).json({ error: 'Refund failed' });
  }
});
```

## Cost Analysis

**Razorpay Pricing:**
- 2% per transaction
- Example: ₹15 print → You get ₹14.70, Razorpay takes ₹0.30

**Your Costs:**
- Paper: ~₹0.50/page
- Ink/Toner: ~₹1/page
- Total: ~₹1.50/page

**Profit:**
- Selling at ₹3/page
- After Razorpay fee: ₹2.94/page
- Profit: ₹2.94 - ₹1.50 = ₹1.44/page

## Support Links

- Razorpay Docs: https://razorpay.com/docs/
- Integration Guide: https://razorpay.com/docs/payments/payment-gateway/web-integration/
- Test Credentials: https://razorpay.com/docs/payments/payments/test-card-details/
- API Reference: https://razorpay.com/docs/api/

---

**Ready to implement?** Start with test mode, verify the flow works, then switch to live keys!
