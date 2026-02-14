# Vercel Frontend Deployment - Complete Guide

## 🎯 Goal
Deploy your DirectPrint frontend to Vercel with proper environment variables and production configuration.

## 📋 Prerequisites

- GitHub account
- Vercel account (free tier is fine)
- Your frontend code pushed to GitHub

## ⚡ Quick Deployment (5 minutes)

### Step 1: Push to GitHub

```bash
cd frontend

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/directprint-frontend.git
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel auto-detects Vite/React
5. Click "Deploy"

That's it! Your site is live at `https://your-project.vercel.app`

## 🔧 Environment Variables Setup

### Step 3: Configure Environment Variables

In Vercel dashboard:

1. Go to your project
2. Click "Settings" → "Environment Variables"
3. Add these variables:

```bash
# Backend API URL (your Oracle VM with DuckDNS)
VITE_API_URL=https://justpri.duckdns.org

# Or if using custom domain:
VITE_API_URL=https://api.directprint.yourdomain.com
```

### Step 4: Frontend .env File Structure

Create these files in your frontend directory:

#### `.env.development` (for local dev)
```bash
VITE_API_URL=http://localhost:3001
```

#### `.env.production` (for Vercel)
```bash
VITE_API_URL=https://justpri.duckdns.org
```

#### `.env.example` (for documentation)
```bash
# Backend API URL
VITE_API_URL=http://localhost:3001
```

### Important: .gitignore

Make sure these are in `.gitignore`:
```
.env
.env.local
.env.development.local
.env.production.local
```

## 📱 Firebase Configuration

### Current Setup (Hardcoded)

If your `firebase.js` currently looks like:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "your-project.firebaseapp.com",
    // ...
};
```

### Better: Environment Variables

Update `firebase.js`:
```javascript
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

Then in Vercel, add:
```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## 🔒 Security: Firebase Config

**Note:** Firebase web config keys are NOT secret! They're designed to be public. The security comes from:
1. Firebase Security Rules
2. Authentication requirements
3. Authorized domains

So it's okay to have them in your frontend code, but using env vars is cleaner.

## 🚀 Automatic Deployments

### Step 5: Configure Git Integration

Vercel automatically deploys when you push to GitHub:

```bash
# Make changes
git add .
git commit -m "Update feature"
git push

# Vercel automatically:
# 1. Detects push
# 2. Builds your app
# 3. Deploys to production
# 4. Updates your URL
```

### Branch Deployments

- **main branch** → Production: `your-app.vercel.app`
- **dev branch** → Preview: `your-app-git-dev.vercel.app`
- **Pull requests** → Preview URLs automatically

## 🌐 Custom Domain Setup

### Step 6: Add Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Click "Settings" → "Domains"
3. Click "Add"
4. Enter your domain: `directprint.yourdomain.com`
5. Follow DNS setup instructions

#### DNS Setup Example:
```
Type: CNAME
Name: directprint
Value: cname.vercel-dns.com
```

Or for apex domain:
```
Type: A
Name: @
Value: 76.76.21.21
```

### Update Environment Variables

If using custom domain, update:
```bash
VITE_API_URL=https://api.yourdomain.com
```

## 📊 Build Configuration

### vercel.json (Optional)

Create `vercel.json` in frontend root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

## 🔄 CI/CD Pipeline

Vercel provides:
- ✅ Automatic builds on push
- ✅ Preview deployments for PRs
- ✅ Instant rollbacks
- ✅ Build logs
- ✅ Performance monitoring

## 🧪 Testing Before Deployment

### Local Production Build

```bash
cd frontend

# Build for production
npm run build

# Preview production build locally
npm run preview
# Opens at http://localhost:4173

# Test thoroughly:
# 1. Login works
# 2. File upload works
# 3. API calls work (to your backend)
# 4. No console errors
```

## 🚨 Common Issues & Fixes

### Issue 1: API Calls Fail

**Problem:** Frontend can't reach backend

**Solution:**
```bash
# Check VITE_API_URL is set correctly
# In Vercel dashboard → Settings → Environment Variables

# Make sure backend CORS allows your Vercel domain
# In backend/.env:
ALLOWED_ORIGINS=https://your-app.vercel.app
```

### Issue 2: Environment Variables Not Working

**Problem:** `import.meta.env.VITE_API_URL` is undefined

**Solution:**
1. Make sure variable name starts with `VITE_`
2. Redeploy after adding env vars
3. Check they're in "Production" scope in Vercel

### Issue 3: Build Fails

**Problem:** Vercel build fails

**Solution:**
```bash
# Check build logs in Vercel dashboard
# Common issues:

# Missing dependencies:
npm install

# TypeScript errors:
# Fix any TS errors locally first

# Build succeeds locally but fails on Vercel:
# Check Node version in Vercel matches local
# Vercel settings → Node.js Version → 18.x
```

### Issue 4: Routing Doesn't Work

**Problem:** Direct URLs return 404

**Solution:**
Create `vercel.json` with rewrites (see above), or add this to `vite.config.js`:

```javascript
export default defineConfig({
  // ... other config
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
```

## 📱 Mobile Testing

After deployment:

1. Open on mobile: `https://your-app.vercel.app`
2. Test QR scanning
3. Test file upload
4. Test payment flow
5. Test on both iOS and Android

## 🔐 Security Headers

Add security headers in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

## 📈 Performance Optimization

### Vite Config Optimizations

```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth'],
        },
      },
    },
  },
});
```

### Lazy Loading

```javascript
// Lazy load heavy components
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

<Suspense fallback={<LoadingSpinner />}>
  <AdminDashboard />
</Suspense>
```

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Connected to Vercel
- [ ] Environment variables configured
- [ ] Backend URL set correctly
- [ ] Firebase config added
- [ ] Custom domain configured (optional)
- [ ] CORS configured on backend
- [ ] Tested on mobile devices
- [ ] No console errors
- [ ] All features work (login, upload, payment)

## 🎯 Final Setup

### Frontend Environment Variables Summary

```bash
# In Vercel Dashboard → Settings → Environment Variables

# Backend API
VITE_API_URL=https://justpri.duckdns.org

# Firebase (optional, can hardcode)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Update Backend CORS

```javascript
// backend/index.js
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'https://your-app.vercel.app',  // Add your Vercel URL
        'http://localhost:5173'
    ];
```

## 🚀 You're Live!

Your frontend is now:
- ✅ Deployed on Vercel
- ✅ Using environment variables
- ✅ Auto-deploying on push
- ✅ Production-ready

Next: Setup your Oracle VM backend! 🎯
