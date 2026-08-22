export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get status/info about the simulator
  const info = {
    status: 'running',
    version: '1.0.0',
    timestamp: Date.now(),
    workers_count: 3,
    api_endpoints: [
      '/api/workers - Get all workers data',
      '/api/worker/[workerId] - Get specific worker data',
      '/api/health - Health check'
    ]
  };

  res.status(200).json(info);
}
