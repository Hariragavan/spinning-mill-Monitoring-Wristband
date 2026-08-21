import React from 'react';

const WORKER_COLORS = ['#2196f3', '#e91e63', '#9c27b0']; // blue, pink, purple

const MapComponent = ({ workers }) => {
  const machines = [
    { id: 'M1', x: 50, y: 55, width: 400, height: 40, label: 'Machine 1' },
    { id: 'M2', x: 50, y: 145, width: 400, height: 40, label: 'Machine 2' },
    { id: 'M3', x: 50, y: 235, width: 400, height: 40, label: 'Machine 3' },
  ];

  // Patrol order: A1→A2→A3→A4 along one side, then B4→B3→B2→B1 back
  const beaconOrder = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1'];

  const getBeaconCoords = (machineId, zone) => {
    const machine = machines.find((m) => m.id === machineId);
    if (!machine) return { x: 0, y: 0 };

    const side = zone.charAt(0);
    const index = parseInt(zone.charAt(1)) - 1; // 0-3

    // Spread 4 beacons evenly along the machine width
    const spacing = machine.width / 5;
    const x = machine.x + spacing + index * spacing;

    // A-side above, B-side below
    const y = side === 'A' ? machine.y - 14 : machine.y + machine.height + 14;

    return { x, y };
  };

  return (
    <div className="map-container">
      <svg width="100%" height="100%" viewBox="0 0 500 310">
        {/* Draw Machines */}
        {machines.map((m) => (
          <g key={m.id}>
            {/* Machine body */}
            <rect
              x={m.x}
              y={m.y}
              width={m.width}
              height={m.height}
              className="machine-rect"
              rx="4"
            />
            <text
              x={m.x + m.width / 2}
              y={m.y + 24}
              className="machine-label"
            >
              {m.label}
            </text>

            {/* Draw Beacons with labels */}
            {beaconOrder.map((zone) => {
              const { x, y } = getBeaconCoords(m.id, zone);
              const side = zone.charAt(0);
              return (
                <g key={`${m.id}-${zone}`}>
                  <circle cx={x} cy={y} r="4" className="beacon-dot" />
                  <text
                    x={x}
                    y={side === 'A' ? y - 8 : y + 12}
                    textAnchor="middle"
                    fontSize="7"
                    fill="#adb5bd"
                  >
                    {zone}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Draw Workers as animated dots */}
        {Object.entries(workers).map(([workerId, data], index) => {
          if (!data || !data.live) return null;

          const beaconId = data.live.last_beacon_id;
          if (!beaconId) return null;

          const parts = beaconId.split('-');
          if (parts.length < 2) return null;
          const [machineId, zone] = parts;
          const { x, y } = getBeaconCoords(machineId, zone);

          // Color based on status
          let fillColor = WORKER_COLORS[index % WORKER_COLORS.length];
          let ringColor = '#4caf50'; // green ring = active
          if (data.live.incident_type !== 'none') {
            ringColor = '#f44336'; // red ring
          } else if (
            data.live.motion_state === 'stationary' &&
            data.live.idle_duration_sec > 10
          ) {
            ringColor = '#ff9800'; // orange ring
          }

          return (
            <g key={workerId}>
              {/* Outer status ring */}
              <circle
                cx={x}
                cy={y}
                r="10"
                fill="none"
                stroke={ringColor}
                strokeWidth="2"
                opacity="0.6"
                style={{
                  transition: 'cx 0.8s ease-in-out, cy 0.8s ease-in-out',
                }}
              />
              {/* Worker dot */}
              <circle
                cx={x}
                cy={y}
                r="6"
                fill={fillColor}
                stroke="white"
                strokeWidth="2"
                style={{
                  transition: 'cx 0.8s ease-in-out, cy 0.8s ease-in-out',
                }}
              />
              {/* Worker label */}
              <text
                x={x}
                y={y + 20}
                textAnchor="middle"
                fontSize="8"
                fontWeight="600"
                fill={fillColor}
                style={{
                  transition: 'x 0.8s ease-in-out, y 0.8s ease-in-out',
                }}
              >
                W{workerId.split('_')[1]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default MapComponent;
