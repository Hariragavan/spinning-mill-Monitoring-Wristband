import React from 'react';
import ZoneMap from '../components/ZoneMap';
import KPIGrid from '../components/KPIGrid';
import EfficiencyChart from '../components/EfficiencyChart';
import KeyInsights from '../components/KeyInsights';
import ModeDurationAnalytics from '../components/ModeDurationAnalytics';
import LiveStatusPanel from '../components/LiveStatusPanel';

const DashboardPage = ({ workers, onWorkerClick, dataMode, beacons = [], telemetryLogs = [] }) => {
  const isLive = dataMode === 'live';

  return (
    <>
      {/* Live mode: show a device status panel above the map */}
      {isLive && <LiveStatusPanel workers={workers} beacons={beacons} />}

      <ZoneMap workers={workers} beacons={beacons} onWorkerClick={onWorkerClick} dataMode={dataMode} />
      <KPIGrid workers={workers} beacons={beacons} telemetryLogs={telemetryLogs} dataMode={dataMode} />

      {/* In live mode, analytics panels are hidden since there is no historical data yet */}
      {!isLive && (
        <>
          <div className="bottom-split">
            <EfficiencyChart />
            <KeyInsights workers={workers} telemetryLogs={telemetryLogs} />
          </div>
          <ModeDurationAnalytics />
        </>
      )}
    </>
  );
};

export default DashboardPage;
