import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

// Initialize Firebase (optional - only if you want to save to database)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

let db = null;
if (firebaseConfig.projectId && firebaseConfig.projectId !== 'YOUR_PROJECT_ID') {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { workerId } = req.query;

  if (!workerId) {
    return res.status(400).json({ error: 'Worker ID is required' });
  }

  try {
    // If Firebase is configured, fetch from database
    if (db) {
      const workerRef = ref(db, `workers/${workerId}/live`);
      const snapshot = await get(workerRef);
      
      if (snapshot.exists()) {
        return res.status(200).json(snapshot.val());
      }
    }

    // Fallback: return mock data
    res.status(200).json({
      message: 'Mock data - configure Firebase to get real data',
      worker_id: workerId,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
