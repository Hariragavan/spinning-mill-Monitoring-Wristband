import React from 'react';
import { Activity, AlertTriangle, BarChart3, Battery, Clock3, Factory, Gauge, Radio, Route, Settings, TrendingDown, UserRound } from 'lucide-react';

const ICONS = { activity: Activity, alerts: AlertTriangle, chart: BarChart3, battery: Battery, clock: Clock3, factory: Factory, gauge: Gauge, radio: Radio, route: Route, settings: Settings, trending: TrendingDown, user: UserRound };

const SummaryCard = ({ label, value, status, icon = 'activity', tone = 'blue' }) => {
  const Icon = ICONS[icon] || Activity;
  return (
    <div className={`summary-card summary-card-${tone}`}>
      <div className="summary-card-header">
        <div className="summary-card-icon"><Icon size={16} strokeWidth={2.2} /></div>
        <span className="summary-card-label">{label}</span>
      </div>
      <div className="summary-card-value">{value}</div>
      {status && <div className="summary-card-status">{status}</div>}
    </div>
  );
};

export default SummaryCard;
