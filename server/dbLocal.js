import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE_PATH = path.join(__dirname, 'database.json');

let useLocalFileDb = false;

export function setLocalFileDb(enabled) {
  useLocalFileDb = enabled;
}

export function isLocalFileDbEnabled() {
  return useLocalFileDb;
}

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
