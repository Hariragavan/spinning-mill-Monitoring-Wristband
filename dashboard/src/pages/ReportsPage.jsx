import React from 'react';

const DAILY_REPORTS = [
  { date: '2026-08-21', shift: 'Morning', totalRounds: 28, avgEfficiency: '93.2%', totalOutput: 3200, downtimeMin: 12, alerts: 2 },
  { date: '2026-08-20', shift: 'Morning', totalRounds: 31, avgEfficiency: '91.8%', totalOutput: 3050, downtimeMin: 18, alerts: 4 },
  { date: '2026-08-19', shift: 'Morning', totalRounds: 25, avgEfficiency: '94.1%', totalOutput: 3400, downtimeMin: 8,  alerts: 1 },
  { date: '2026-08-18', shift: 'Morning', totalRounds: 30, avgEfficiency: '90.5%', totalOutput: 2950, downtimeMin: 22, alerts: 5 },
  { date: '2026-08-17', shift: 'Morning', totalRounds: 27, avgEfficiency: '92.9%', totalOutput: 3150, downtimeMin: 10, alerts: 3 },
  { date: '2026-08-16', shift: 'Morning', totalRounds: 33, avgEfficiency: '95.0%', totalOutput: 3500, downtimeMin: 5,  alerts: 0 },
  { date: '2026-08-15', shift: 'Morning', totalRounds: 29, avgEfficiency: '91.2%', totalOutput: 3100, downtimeMin: 15, alerts: 3 },
];

const WORKER_SUMMARY = [
  { name: 'Alex P.',  daysWorked: 6, avgHours: '7.8 hr', totalRounds: 72, onTimeRate: '100%' },
  { name: 'Raj K.',   daysWorked: 5, avgHours: '7.5 hr', totalRounds: 58, onTimeRate: '80%' },
  { name: 'Maria S.', daysWorked: 6, avgHours: '7.2 hr', totalRounds: 64, onTimeRate: '100%' },
];

const ReportsPage = () => {
  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Reports</h2>
        <p className="page-subtitle">Daily shift summaries and weekly attendance reports</p>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-value">7</div><div className="summary-label">Days Reported</div></div>
        <div className="summary-card"><div className="summary-value">203</div><div className="summary-label">Total Rounds (Week)</div></div>
        <div className="summary-card"><div className="summary-value green">92.7%</div><div className="summary-label">Avg Efficiency</div></div>
        <div className="summary-card"><div className="summary-value">90 min</div><div className="summary-label">Total Downtime</div></div>
      </div>

      {/* Daily Shift Report */}
      <div className="card table-card">
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Daily Shift Report</div>
        <table>
          <thead>
            <tr><th>Date</th><th>Shift</th><th>Rounds</th><th>Efficiency</th><th>Output</th><th>Downtime</th><th>Alerts</th></tr>
          </thead>
          <tbody>
            {DAILY_REPORTS.map((r, i) => (
              <tr key={i}>
                <td className="cell-primary">{r.date}</td>
                <td>{r.shift}</td>
                <td>{r.totalRounds}</td>
                <td><span className={parseFloat(r.avgEfficiency) >= 92 ? 'text-green' : 'text-amber'}>{r.avgEfficiency}</span></td>
                <td>{r.totalOutput.toLocaleString()}</td>
                <td>{r.downtimeMin} min</td>
                <td>{r.alerts > 0 ? <span className="text-red">{r.alerts}</span> : <span className="text-muted">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Attendance Summary */}
      <div className="card table-card">
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Weekly Attendance Summary</div>
        <table>
          <thead>
            <tr><th>Operator</th><th>Days Worked</th><th>Avg Hours/Day</th><th>Total Rounds</th><th>On-Time Rate</th></tr>
          </thead>
          <tbody>
            {WORKER_SUMMARY.map((w, i) => (
              <tr key={i}>
                <td className="cell-primary">{w.name}</td>
                <td>{w.daysWorked}/7</td>
                <td>{w.avgHours}</td>
                <td>{w.totalRounds}</td>
                <td><span className={w.onTimeRate === '100%' ? 'text-green' : 'text-amber'}>{w.onTimeRate}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportsPage;
