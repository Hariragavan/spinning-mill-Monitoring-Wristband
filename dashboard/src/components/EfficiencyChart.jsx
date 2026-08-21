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

// Generate initial 24-hour efficiency data with smooth curves
function generateEfficiencyData() {
  const data = [];
  for (let h = 0; h <= 24; h++) {
    // Simulate a realistic efficiency curve: dips at shift changes (6am, 2pm, 10pm)
    let base = 90;
    if (h >= 0 && h < 6) base = 82 + Math.sin(h * 0.5) * 4;
    else if (h >= 6 && h < 8) base = 88 + (h - 6) * 2;
    else if (h >= 8 && h < 12) base = 93 + Math.sin(h * 0.8) * 2;
    else if (h >= 12 && h < 14) base = 89 + Math.sin(h) * 3;
    else if (h >= 14 && h < 18) base = 94 + Math.sin(h * 0.6) * 1.5;
    else if (h >= 18 && h < 22) base = 91 + Math.sin(h * 0.4) * 2;
    else base = 85 + Math.sin(h) * 3;

    data.push({
      hour: `${h}:00`,
      efficiency: Math.round((base + (Math.random() - 0.5) * 2) * 10) / 10,
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
        boxShadow: '0 4px 6px rgba(0,0,0,0.06)',
        fontSize: '0.8rem',
      }}>
        <div style={{ color: '#64748b', marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 700, color: '#14b8a6' }}>
          {payload[0].value}%
        </div>
      </div>
    );
  }
  return null;
};

const EfficiencyChart = () => {
  const [data, setData] = useState(() => generateEfficiencyData());

  // Slowly update the latest data point to simulate live feed
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = {
          ...last,
          efficiency: Math.round((last.efficiency + (Math.random() - 0.5) * 1.5) * 10) / 10,
        };
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card chart-card">
      <div className="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        Efficiency Trend — Today
      </div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
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
              domain={[75, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="efficiency"
              stroke="#14b8a6"
              strokeWidth={2.5}
              fill="url(#tealGradient)"
              dot={false}
              activeDot={{ r: 5, fill: '#14b8a6', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EfficiencyChart;
