import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import type { OpsRoomView } from '@smart-campus/shared-types';

function roomColor(room: OpsRoomView, metric: 'occupancy' | 'temperature' | 'co2') {
  if (metric === 'occupancy') return room.occupied ? '#1a6b5c' : '#c5d0c8';
  if (metric === 'temperature') {
    if (room.temperature == null) return '#9aa8b5';
    if (room.temperature > 27) return '#c45c26';
    return '#1a6b5c';
  }
  if (room.co2 == null) return '#9aa8b5';
  if (room.co2 > 1000) return '#b91c1c';
  if (room.co2 > 800) return '#b45309';
  return '#1a6b5c';
}

function RoomBox({
  room,
  index,
  metric,
  selected,
  onSelect,
}: {
  room: OpsRoomView;
  index: number;
  metric: 'occupancy' | 'temperature' | 'co2';
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const x = (index % 4) * 2.4 - 3.6;
  const z = Math.floor(index / 4) * 2.2 - 1.4;
  const y = room.floor * 2.4;
  return (
    <group position={[x, y, z]} onClick={(event) => { event.stopPropagation(); onSelect(room.id); }}>
      <RoundedBox args={[2.1, 1.4, 1.8]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color={roomColor(room, metric)} roughness={0.45} metalness={0.08} />
      </RoundedBox>
      {selected ? (
        <Html position={[0, 1.1, 0]} center>
          <div className="rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs shadow-soft">
            <p className="font-semibold text-campus-ink">{room.code}</p>
            <p className="text-campus-deep/70">{room.occupied ? `${room.people} pessoas` : 'Livre'}</p>
          </div>
        </Html>
      ) : (
        <Html position={[0, 0.05, 0.95]} center>
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-campus-ink">{room.code}</span>
        </Html>
      )}
    </group>
  );
}

export function CampusTwinCanvas({
  rooms,
  metric,
  selectedId,
  onSelect,
}: {
  rooms: OpsRoomView[];
  metric: 'occupancy' | 'temperature' | 'co2';
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const floors = useMemo(() => [...new Set(rooms.map((room) => room.floor))].sort(), [rooms]);

  return (
    <Canvas camera={{ position: [8, 7, 10], fov: 42 }} className="h-full w-full">
      <color attach="background" args={['#e8eef3']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} />
      <hemisphereLight args={['#f7faf8', '#9eb2a8', 0.4]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]} receiveShadow>
        <circleGeometry args={[12, 48]} />
        <meshStandardMaterial color="#d5e0d8" />
      </mesh>
      {floors.map((floor) => (
        <mesh key={floor} position={[0, floor * 2.4 - 0.85, 0]}>
          <boxGeometry args={[11.5, 0.08, 7.2]} />
          <meshStandardMaterial color="#f4f7fa" transparent opacity={0.7} />
        </mesh>
      ))}
      {rooms.map((room) => (
        <RoomBox
          key={room.id}
          room={room}
          index={rooms.filter((item) => item.floor === room.floor).findIndex((item) => item.id === room.id)}
          metric={metric}
          selected={selectedId === room.id}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls enablePan={false} minDistance={6} maxDistance={18} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}
