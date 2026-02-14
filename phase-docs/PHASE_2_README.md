# Phase 2: Authentication - Complete Guide

## 🎯 Goal
Add Google OAuth authentication using Firebase, protect API routes, and associate users with their print jobs.

## 📋 What We're Building

### Features:
- ✅ Google Sign-In (via Firebase)
- ✅ Protected API routes
- ✅ User session management
- ✅ User-job association
- ✅ JWT token verification

## 🏗️ Architecture Overview

```
User → Frontend (Firebase Auth) → Backend (Token Verification) → Database
         [Gets JWT Token]            [Validates Token]              [Stores user_id]
```

## ⚡ Quick Start

### Step 1: Firebase Setup (5 minutes)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Sign in with your Google account

2. **Create Project**
   - Click "Add project"
   - Name: "DirectPrint" (or your preferred name)
   - Disable Google Analytics (optional, we don't need it)
   - Click "Create project"

3. **Add Web App**
   - In project overview, click the web icon (`</>`)
   - App nickname: "DirectPrint Web"
   - Don't check "Firebase Hosting"
   - Click "Register app"
   - **Copy the Firebase config** (you'll need this)

4. **Enable Google Authentication**
   - In Firebase Console, go to "Authentication" → "Sign-in method"
   - Click "Google"
   - Toggle "Enable"
   - Select support email
   - Click "Save"

5. **Add Authorized Domains**
   - Still in "Authentication" → "Settings" → "Authorized domains"
   - Add your domains:
     - `localhost` (already there)
     - `qr-wifi-printer.vercel.app` (your Vercel domain)
     - Any other domains you'll use

6. **Get Service Account Key (for Backend)**
   - Go to "Project settings" (gear icon) → "Service accounts"
   - Click "Generate new private key"
   - Download the JSON file
   - **Keep this file secure! Don't commit to Git!**

### Step 2: Backend Setup

#### Install Dependencies
```bash
cd backend
npm install firebase-admin
```

#### Add Service Account Key
```bash
# Create a secure directory for credentials
mkdir -p backend/config

# Move the downloaded service account JSON here
# Rename it to something simple
mv ~/Downloads/directprint-*.json backend/config/firebase-service-account.json

# Add to .gitignore (IMPORTANT!)
echo "config/firebase-service-account.json" >> backend/.gitignore
```

#### Update .env
```bash
# Add to backend/.env
cat >> backend/.env << 'EOF'

# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
EOF
```

#### Copy New Backend Files
```bash
# Backup current backend
cp backend/index.js backend/index.js.phase1-backup

# Copy new authenticated backend
cp auth-middleware.js backend/auth-middleware.js
cp index-v4-auth.js backend/index.js
```

### Step 3: Frontend Setup

#### Install Firebase SDK
```bash
cd frontend
npm install firebase
```

#### Create Firebase Config
```bash
# Create firebase config file
cat > frontend/src/firebase.js << 'EOF'
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
EOF

# Now edit this file with your actual Firebase config values
nano frontend/src/firebase.js
```

#### Copy Frontend Components
```bash
# Copy authentication components
cp AuthProvider.jsx frontend/src/components/AuthProvider.jsx
cp Login.jsx frontend/src/components/Login.jsx
cp ProtectedRoute.jsx frontend/src/components/ProtectedRoute.jsx
```

### Step 4: Test Authentication

#### Start Backend
```bash
cd backend
node index.js
```

Expected output:
```
╔═══════════════════════════════════════════╗
║   DirectPrint Server V4 - Running         ║
║   Database: PostgreSQL ✅                 ║
║   Auth: Firebase ✅                       ║
║   Port: 3001                              ║
╚═══════════════════════════════════════════╝
```

#### Start Frontend
```bash
cd frontend
npm run dev
```

#### Test Login Flow
1. Open browser: http://localhost:5173
2. Click "Sign in with Google"
3. Select your Google account
4. Should redirect to main app
5. Check browser console for auth token

## 📁 File Structure After Phase 2

```
backend/
├── index.js                          # NEW: Auth-enabled server
├── auth-middleware.js                # NEW: JWT verification
├── db.js                             # Existing from Phase 1
├── config/
│   └── firebase-service-account.json # NEW: Firebase credentials (DON'T COMMIT!)
├── .env                              # UPDATED: Added Firebase config
└── .gitignore                        # UPDATED: Ignore credentials

frontend/
├── src/
│   ├── firebase.js                   # NEW: Firebase initialization
│   ├── components/
│   │   ├── AuthProvider.jsx          # NEW: Auth context
│   │   ├── Login.jsx                 # NEW: Login page
│   │   └── ProtectedRoute.jsx        # NEW: Route protection
│   └── App.jsx                       # UPDATED: Wrapped with auth
```

## 🔐 How Authentication Works

### 1. User Login Flow
```
User clicks "Sign in with Google"
  ↓
Firebase shows Google account picker
  ↓
User selects account and grants permission
  ↓
Firebase returns user object + JWT token
  ↓
Frontend stores token in localStorage
  ↓
All API requests include token in Authorization header
```

### 2. API Request Flow
```
Frontend sends request with: Authorization: Bearer <token>
  ↓
Backend middleware extracts token
  ↓
Firebase Admin SDK verifies token
  ↓
If valid: req.user = decoded token (contains uid, email, etc.)
  ↓
Route handler can access req.user
```

### 3. Database Integration
```
User creates print job
  ↓
Backend gets user_id from req.user.uid
  ↓
Saves job with user_id in database
  ↓
User can only see their own jobs
```

## 🧪 Testing Checklist

### Backend Tests
```bash
# Test 1: Server starts with Firebase
cd backend
node index.js
# Should see "Auth: Firebase ✅"

# Test 2: Unprotected endpoint (should work)
curl http://localhost:3001/api/status
# Should return JSON status

# Test 3: Protected endpoint without token (should fail)
curl http://localhost:3001/api/jobs/create
# Should return 401 Unauthorized
```

### Frontend Tests
1. ✅ Login button appears
2. ✅ Click login → Google popup appears
3. ✅ After login → Shows user email/name
4. ✅ Can upload file and create job
5. ✅ Job is associated with your user ID
6. ✅ Logout works
7. ✅ After logout → Redirected to login page

### Database Tests
```bash
# Check if user was created
psql -U printuser -d printkiosk -h localhost
SELECT * FROM users;
# Should show your Google account

# Check if job has user_id
SELECT id, user_id, filename FROM jobs LIMIT 5;
# user_id should not be NULL

\q
```

## 🔧 API Changes

### Before Phase 2 (No Auth):
```javascript
// Anyone could create jobs
POST /api/jobs/create
{
  "kiosk_id": "kiosk_001"
}
```

### After Phase 2 (Auth Required):
```javascript
// Must include auth token
POST /api/jobs/create
Headers: {
  "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6..."
}
Body: {
  "kiosk_id": "kiosk_001"
}

// Backend automatically adds user_id from token
```

### Protected Routes:
- ✅ `POST /api/jobs/create` - Must be authenticated
- ✅ `GET /api/jobs/:job_id/status` - Must be authenticated (own jobs only)
- ❌ `POST /api/connect` - Public (kiosk discovery)
- ❌ `GET /api/status` - Public (health check)

### Admin Routes (for later):
- `GET /api/admin/kiosks` - Admin only
- `GET /api/admin/jobs` - Admin only

## 🛡️ Security Features

1. **JWT Token Verification** - Every token is verified by Firebase Admin SDK
2. **User Isolation** - Users can only see their own jobs
3. **Token Expiration** - Tokens expire after 1 hour (Firebase default)
4. **Secure Credentials** - Service account key not in Git
5. **CORS Protection** - Only allowed origins can access API

## 🔄 Frontend Integration

### Wrapping App with Auth
```javascript
// frontend/src/main.jsx
import { AuthProvider } from './components/AuthProvider';

root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
```

### Using Auth in Components
```javascript
import { useAuth } from './components/AuthProvider';

function UploadPage() {
  const { user, token } = useAuth();
  
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('http://localhost:3001/api/jobs/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
  };
}
```

### Protected Routes
```javascript
import { ProtectedRoute } from './components/ProtectedRoute';

<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  } />
</Routes>
```

## 🚨 Common Issues & Fixes

### Issue 1: "Firebase config is invalid"
**Fix:** Double-check your firebase.js config values match exactly from Firebase Console

### Issue 2: "401 Unauthorized" on all requests
**Fix:** Check that:
- Token is being sent in Authorization header
- Token format is: `Bearer <token>` (note the space)
- Service account JSON path is correct in .env

### Issue 3: "Unable to verify token"
**Fix:** 
- Make sure firebase-service-account.json is in backend/config/
- Check FIREBASE_SERVICE_ACCOUNT_PATH in .env
- Restart backend server after adding service account

### Issue 4: "User not found in database"
**Fix:** User is auto-created on first API call. Make a request and check again.

### Issue 5: "CORS error on login"
**Fix:** 
- Add your frontend URL to Firebase authorized domains
- Add to ALLOWED_ORIGINS in backend/.env

## 📊 Database Changes

New queries available:

```sql
-- Get all jobs for a specific user
SELECT * FROM jobs WHERE user_id = 'firebase-uid-here';

-- Get user statistics
SELECT 
  u.email,
  COUNT(j.id) as total_jobs,
  SUM(j.total_cost) as total_spent
FROM users u
LEFT JOIN jobs j ON u.id = j.user_id
GROUP BY u.id, u.email;

-- Active users today
SELECT DISTINCT u.email
FROM users u
JOIN jobs j ON u.id = j.user_id
WHERE j.created_at > NOW() - INTERVAL '1 day';
```

## 🎯 Success Criteria

Phase 2 is complete when:

- [✅] Backend starts with Firebase initialized
- [✅] Can login with Google on frontend
- [✅] Token is stored in browser
- [✅] API requests include Authorization header
- [✅] Jobs are created with user_id
- [✅] Users can only see their own jobs
- [✅] Logout clears token and redirects
- [✅] Protected routes reject unauthenticated requests

## 🚀 Next Steps (Phase 3)

After Phase 2 is complete:
1. ✅ Users can login with Google
2. ✅ API routes are protected
3. ✅ Jobs are associated with users

Then move to **Phase 3: QR Code Discovery** (Quick win!)

## 💡 Tips

- **Development:** Use your personal Google account
- **Testing:** Open in Incognito to test fresh login
- **Debugging:** Check browser console for token issues
- **Security:** Never commit firebase-service-account.json!

---

**Need help?** Let me know if you hit any issues during setup! 🆘
