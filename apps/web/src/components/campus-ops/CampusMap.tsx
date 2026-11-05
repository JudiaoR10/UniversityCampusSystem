import type { OpsRoomView } from '@smart-campus/shared-types';
import type { CampusBuildingView, OpsMetric } from './types';

function pinColor(building: CampusBuildingView, metric: OpsMetric): string {
  const status =
    metric === 'occupancy'
      ? building.utilisation.status
      : metric === 'temperature'
        ? building.temperature.status
        : metric === 'co2'
          ? building.co2.status
          : building.humidity.status;

  if (status === 'GOOD') return '#1f7a6c';
  if (status === 'LOW') return '#c45c26';
  if (status === 'WARN') return '#b45309';
  return '#b91c1c';
}

function pinLabel(building: CampusBuildingView, metric: OpsMetric): string {
  const fmt = (value: number | null, suffix: string) => (value == null ? '—' : `${value}${suffix}`);
  if (metric === 'occupancy') return fmt(building.utilisation.value, '%');
  if (metric === 'temperature') return fmt(building.temperature.value, '°');
  if (metric === 'co2') return fmt(building.co2.value, '');
  return fmt(building.humidity.value, '%');
}

function roomFill(room: OpsRoomView, metric: OpsMetric) {
  if (metric === 'occupancy') return room.occupied ? '#1a6b5c' : '#d7e3dc';
  if (metric === 'temperature') {
    if (room.temperature == null) return '#dce4ec';
    if (room.temperature > 27) return '#c45c26';
    return '#1a6b5c';
  }
  if (room.co2 == null) return '#dce4ec';
  if (room.co2 > 1000) return '#b91c1c';
  if (room.co2 > 800) return '#b45309';
  return '#1a6b5c';
}

export function CampusMap({
  buildings,
  rooms = [],
  metric,
  selectedId,
  onSelect,
}: {
  buildings: CampusBuildingView[];
  rooms?: OpsRoomView[];
  metric: OpsMetric;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const d2 = buildings.find((building) => building.code === 'D2') ?? buildings[0];
  const floors = [0, 1];

  return (
    <div className="campus-ops-map relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-campus-line/70 sm:min-h-[360px]">
      <svg viewBox="0 0 1000 640" className="h-full w-full" role="img" aria-label="Mapa esquemático do edifício D2">
        <defs>
          <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#dce8df" />
            <stop offset="55%" stopColor="#e8eef4" />
            <stop offset="100%" stopColor="#d5e0ea" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0f2744" floodOpacity="0.12" />
          </filter>
        </defs>

        <rect width="1000" height="640" fill="url(#ground)" />
        <path d="M0 500 C220 460 420 540 1000 490 L1000 640 L0 640 Z" fill="#b7cfc0" opacity="0.5" />
        <text x="48" y="580" fill="#3f5d4f" fontSize="16" fontFamily="IBM Plex Sans, sans-serif">
          Campus UJAC · silhueta do D2
        </text>

        {floors.map((floor, floorIndex) => {
          const y = 70 + floorIndex * 230;
          const floorRooms = rooms.filter((room) => room.floor === floor && (!d2 || room.buildingId === d2.id));
          return (
            <g key={floor} filter="url(#soft)">
              <rect x="80" y={y} width="840" height="200" rx="28" fill="#f7faf8" stroke="#c5d4cc" strokeWidth="2" />
              <text x="108" y={y + 36} fill="#1a6b5c" fontSize="18" fontWeight="700" fontFamily="Manrope, sans-serif">
                Piso {floor}
              </text>
              {floorRooms.map((room, index) => {
                const width = Math.min(150, 700 / Math.max(floorRooms.length, 1) - 12);
                const x = 118 + index * (width + 16);
                return (
                  <g key={room.id} style={{ cursor: 'pointer' }} onClick={() => d2 && onSelect(d2.id)}>
                    <rect
                      x={x}
                      y={y + 58}
                      width={width}
                      height="110"
                      rx="16"
                      fill={roomFill(room, metric)}
                      opacity={room.occupied ? 0.92 : 0.55}
                    />
                    <text
                      x={x + width / 2}
                      y={y + 108}
                      textAnchor="middle"
                      fill={room.occupied || metric !== 'occupancy' ? '#fff' : '#10233d'}
                      fontSize="13"
                      fontWeight="700"
                      fontFamily="IBM Plex Sans, sans-serif"
                    >
                      {room.code}
                    </text>
                    <text
                      x={x + width / 2}
                      y={y + 130}
                      textAnchor="middle"
                      fill={room.occupied || metric !== 'occupancy' ? '#f4f7fa' : '#1a3a5c'}
                      fontSize="11"
                      fontFamily="IBM Plex Sans, sans-serif"
                    >
                      {room.occupied ? `${room.people} pess.` : 'livre'}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {buildings.map((b, idx) => {
          const cx = (b.mapX / 100) * 1000;
          const cy = (b.mapY / 100) * 640;
          const selected = selectedId === b.id;
          const color = pinColor(b, metric);
          return (
            <g
              key={b.id}
              className="campus-ops-pin"
              style={{ cursor: 'pointer', animationDelay: `${220 + idx * 80}ms` }}
              onClick={() => onSelect(b.id)}
            >
              <circle cx={cx} cy={cy} r={selected ? 34 : 28} fill={color} opacity={0.2} className="campus-ops-pulse" />
              <circle cx={cx} cy={cy} r={selected ? 22 : 18} fill={color} stroke="#fff" strokeWidth="3" />
              <text
                x={cx}
                y={cy + 5}
                textAnchor="middle"
                fill="#fff"
                fontSize="12"
                fontWeight="700"
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {pinLabel(b, metric)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white/70 to-transparent p-4">
        <p className="font-display text-xl font-semibold text-campus-ink">Edifício D2</p>
        <p className="text-xs text-campus-deep/70">Dois pisos · salas coloridas pela métrica seleccionada</p>
      </div>
    </div>
  );
}
