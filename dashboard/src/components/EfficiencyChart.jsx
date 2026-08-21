import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Generate 24-hour spindle RPM data for spinning mill machines
function generateRPMData() {
  const data = [];
  for (let h = 0; h <= 24; h++) {
    // Realistic spinning mill RPM: averages around 18,200 RPM with minor dips at shift changes
    let baseRPM = 18200;
    if (h >= 0 && h < 6) baseRPM = 17500 + Math.sin(h * 0.5) * 400;
    else if (h >= 6 && h < 8) baseRPM = 16800 + (h - 6) * 600; // shift transition
    else if (h >= 8 && h < 12) baseRPM = 18600 + Math.sin(h * 0.8) * 300;
    else if (h >= 12 && h < 14) baseRPM = 17900 + Math.sin(h) * 400;
    else if (h >= 14 && h < 18) baseRPM = 18900 + Math.sin(h * 0.6) * 250;
    else if (h >= 18 && h < 22) baseRPM = 18350 + Math.sin(h * 0.4) * 350;
    else baseRPM = 17600 + Math.sin(h) * 500;

    data.push({
      hour: `${h}:00`,
      rpm: Math.round(baseRPM + (Math.random() - 0.5) * 200),
    });
  }
  return data;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontSize: '0.8rem',
      }}>
        <div style={{ color: '#64748b', marginBottom: 2, fontWeight: 600 }}>{label}</div>
        <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.95rem' }}>
          {payload[0].value.toLocaleString()} RPM
        </div>
      </div>
    );
  }
  return null;
};

const EfficiencyChart = () => {
  const [data, setData] = useState(() => generateRPMData());

  // Slowly update the latest data point to simulate live feed
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        const newRpm = Math.max(15000, Math.min(20000, Math.round(last.rpm + (Math.random() - 0.5) * 180)));
        updated[updated.length - 1] = {
          ...last,
          rpm: newRpm,
        };
        return updated;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card chart-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 12l4-4"/>
            <path d="M12 7v1"/><path d="M12 16v1"/>
          </svg>
          Spindle RPM Trend — Today
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: 12 }}>
          Live RPM Feed
        </span>
      </div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="rpmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0284c7" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="hour"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              interval={3}
            />
            <YAxis
              domain={[14000, 20000]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="rpm"
              stroke="#0284c7"
              strokeWidth={2.5}
              fill="url(#rpmGradient)"
              dot={false}
              activeDot={{ r: 5, fill: '#0284c7', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EfficiencyChart;
