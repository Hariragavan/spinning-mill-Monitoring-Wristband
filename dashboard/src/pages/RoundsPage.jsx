import React from 'react';

const NAMES = { worker_1: 'Alex P.', worker_2: 'Raj K.', worker_3: 'Maria S.' };

const RoundsPage = ({ workers }) => {
  const workerList = Object.entries(workers).filter(([, d]) => d?.live);
  const totalRounds = workerList.reduce((s, [, d]) => s + d.live.lap_count, 0);

  // Generate a fake round log
  const roundLog = [];
  workerList.forEach(([id, data]) => {
    for (let i = 1; i <= data.live.lap_count; i++) {
      const mins = 5 + Math.floor(Math.random() * 4);
      const secs = Math.floor(Math.random() * 60);
      roundLog.push({
        worker: NAMES[id] || id,
        machine: data.live.current_machine,
        round: i,
        duration: `${mins}m ${secs}s`,
        beaconsHit: 8,
        completedAt: new Date(Date.now() - (data.live.lap_count - i) * 420000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
  });
  roundLog.reverse(); // latest first

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Rounds</h2>
        <p className="page-subtitle">Patrol round tracking \u2014 each round = 8 beacon checkpoints per machine</p>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-value">{totalRounds}</div><div className="summary-label">Total Rounds Today</div></div>
        <div className="summary-card"><div className="summary-value">{workerList.length}</div><div className="summary-label">Active Patrollers</div></div>
        <div className="summary-card"><div className="summary-value">6m 42s</div><div className="summary-label">Avg Round Time</div></div>
        <div className="summary-card"><div className="summary-value">8/8</div><div className="summary-label">Beacons per Round</div></div>
      </div>

      {/* Per-worker round summary */}
      <div className="card">
        <div className="card-title">Rounds per Operator</div>
        <div className="round-bars">
          {workerList.map(([id, data]) => (
            <div key={id} className="round-bar-row">
              <span className="round-bar-label">{NAMES[id] || id}</span>
              <div className="round-bar-track">
                <div className="round-bar-fill" style={{ width: `${Math.min(100, (data.live.lap_count / 15) * 100)}%` }} />
              </div>
              <span className="round-bar-value">{data.live.lap_count} rounds</span>
            </div>
          ))}
        </div>
      </div>

      {/* Round log table */}
      <div className="card table-card">
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Round History</div>
        <table>
          <thead>
            <tr><th>Time</th><th>Operator</th><th>Machine</th><th>Round #</th><th>Duration</th><th>Beacons</th></tr>
          </thead>
          <tbody>
            {roundLog.slice(0, 20).map((r, i) => (
              <tr key={i}>
                <td className="text-muted">{r.completedAt}</td>
                <td className="cell-primary">{r.worker}</td>
                <td>{r.machine}</td>
                <td>#{r.round}</td>
                <td>{r.duration}</td>
                <td><span className="status-badge status-good">{r.beaconsHit}/8</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RoundsPage;
