# Vercel Deployment Guide

## Setup Steps

### 1. Create Firebase Project (Optional but Recommended)
- Go to https://firebase.google.com
- Create a new project
- Enable Realtime Database
- Copy your Firebase credentials

### 2. Prepare Environment Variables
Create a `.env.local` file in the dashboard folder:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
cd dashboard
vercel
```

### 4. Configure Environment Variables in Vercel Dashboard
- Go to your project settings in Vercel
- Add the same environment variables (without VITE_ prefix for API functions)

### 5. API Endpoints
After deployment, you'll have:
- Dashboard: `https://your-project.vercel.app/`
- API Workers: `https://your-project.vercel.app/api/workers`
- Health: `https://your-project.vercel.app/api/health`
- Individual Worker: `https://your-project.vercel.app/api/worker/worker_1`

## Project Structure
```
dashboard/
├── api/
│   ├── health.js           # Health check endpoint
│   ├── workers.js          # Get all workers mock data
│   └── worker/
│       └── [workerId].js   # Get specific worker data
├── src/
│   └── ...                 # React components
├── public/
│   └── ...                 # Static files
├── vercel.json             # Vercel configuration
├── package.json
└── vite.config.ts
```

## API Usage Examples

### Get All Workers
```
GET /api/workers
Response: { workers: [...] }
```

### Get Specific Worker
```
GET /api/worker/worker_1
Response: { worker_id, motion_state, incident_type, ... }
```

### Health Check
```
GET /api/health
Response: { status, version, api_endpoints }
```

## Notes
- Simulator functions run on-demand (serverless)
- Data is generated fresh with each request
- For persistent storage, configure Firebase Realtime Database
- CORS is enabled for all API endpoints
