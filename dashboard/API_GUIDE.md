# Dashboard for Spinning Mill Monitoring System

This is a React + Vite dashboard for monitoring worker safety and productivity in spinning mills using IoT wristbands and BLE beacons.

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Endpoints

When running locally, the dashboard includes built-in API endpoints:

### GET `/api/workers`
Returns mock data for all workers in real-time simulation.

**Response:**
```json
{
  "workers": [
    {
      "worker_id": "worker_1",
      "current_zone": "Side A",
      "last_beacon_id": "M1-A1",
      "motion_state": "walking",
      "incident_type": "none",
      "wristband_battery_pct": 95,
      "timestamp": 1692345600000,
      ...
    }
  ]
}
```

### GET `/api/worker/:workerId`
Returns data for a specific worker.

**Example:**
```bash
curl http://localhost:5173/api/worker/worker_1
```

### GET `/api/health`
Health check and API information.

## Vercel Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Key Features
- ✅ Serverless Functions for simulator (no separate backend needed)
- ✅ Real-time mock data generation
- ✅ Firebase integration (optional)
- ✅ CORS enabled for API access
- ✅ Environment variables support

## Environment Variables

Create a `.env.local` file (see `.env.example`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
# ... other Firebase config
```

## Features

- 👷 Real-time worker location tracking
- 🚨 Incident detection and alerts
- 📊 Performance analytics
- 🔋 Wristband battery monitoring
- 🎯 Beacon-based positioning
- 📈 Historical data and reports

## Technologies

- **Frontend:** React 19, Vite, Recharts
- **Icons:** Lucide React
- **Backend:** Vercel Functions, Firebase (optional)
- **UI Components:** Custom React components

## Project Structure

```
.
├── api/                    # Vercel serverless functions
│   ├── health.js
│   ├── workers.js
│   └── worker/
│       └── [workerId].js
├── src/
│   ├── components/        # React components
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/               # Static files
├── vite.config.ts        # Vite configuration
├── vercel.json           # Vercel deployment config
├── package.json
└── DEPLOYMENT.md         # Deployment guide
```

## License

MIT
