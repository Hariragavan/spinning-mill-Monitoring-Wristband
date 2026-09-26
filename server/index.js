import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import deviceRoutes from './routes/deviceRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'your-anon-key-here';

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Request logging ──────────────────────────────────────
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') {
    console.log(`${req.method} ${req.url}`);
  }
  next();
});

// ── Local File Database Fallback ──
const DB_FILE_PATH = path.join(__dirname, 'database.json');
let useLocalFileDb = false;

export async function saveLocalRecord(payload) {
  try {
    let data = [];
    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
      data = JSON.parse(content || '[]');
    }
    const newRecord = {
      _id: 'local_' + Math.random().toString(36).substr(2, 9),
      ...payload,
      received_at: new Date().toISOString()
    };
    data.push(newRecord);
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2));
    return newRecord;
  } catch (err) {
    console.error('Failed to write to local JSON file db:', err.message);
    throw err;
  }
}

export async function getLatestLocalRecords(deviceIds) {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) return {};
    const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
    const data = JSON.parse(content || '[]');
    
    const latestMap = {};
    const sorted = data.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
    
    for (const record of sorted) {
      if (deviceIds.includes(record.device_id) && !latestMap[record.device_id]) {
        latestMap[record.device_id] = record;
      }
    }
    return latestMap;
  } catch (err) {
    console.error('Failed to read from local JSON file db:', err.message);
    return {};
  }
}

export function isLocalFileDbEnabled() {
  return useLocalFileDb;
}

// ── Routes ───────────────────────────────────────────────
app.use('/api', deviceRoutes);

// ── Connection Strategy ──────────────────────────────────
async function start() {
  console.log('Connecting to Supabase Database...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/workers?select=count`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      console.log(`✓ Connected to Supabase Database (${SUPABASE_URL})`);
    } else {
      console.log(`⚠️ Supabase status: HTTP ${res.status}. Set SUPABASE_URL and SUPABASE_KEY in server/.env`);
    }
  } catch (error) {
    console.log(`⚠️ Supabase connection warning (${error.message}). Using local fallback mode if unconfigured.`);
  }

  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`  Database Target: Supabase (PostgreSQL)`);
    console.log(`  POST http://localhost:${PORT}/api/device-data  — ESP32 sends data here`);
    console.log(`  GET  http://localhost:${PORT}/api/workers      — Dashboard polls here`);
  });
}

start();
