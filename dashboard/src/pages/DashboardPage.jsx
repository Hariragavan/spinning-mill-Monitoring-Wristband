import React from 'react';
import ZoneMap from '../components/ZoneMap';
import KPIGrid from '../components/KPIGrid';
import EfficiencyChart from '../components/EfficiencyChart';
import KeyInsights from '../components/KeyInsights';

const DashboardPage = ({ workers, onWorkerClick }) => {
  return (
    <>
      <ZoneMap workers={workers} onWorkerClick={onWorkerClick} />
      <KPIGrid workers={workers} />
      <div className="bottom-split">
        <EfficiencyChart />
        <KeyInsights />
      </div>
    </>
  );
};

export default DashboardPage;
