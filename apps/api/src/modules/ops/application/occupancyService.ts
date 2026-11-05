import { prisma } from '../../../lib/prisma.js';

export type RoomOccupancy = {
  roomId: string;
  occupied: boolean;
  people: number;
  source: 'schedule' | 'sensor' | 'none';
  isDemo: boolean;
};

export async function computeOccupancyByRoom() {
  const now = new Date();
  const [rooms, liveSchedules, latestReadings] = await Promise.all([
    prisma.room.findMany({ select: { id: true, capacity: true } }),
    prisma.classSchedule.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now }, roomId: { not: null } },
      select: { roomId: true, subjectId: true },
    }),
    prisma.reading.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 800,
      include: {
        sensor: { select: { metric: true, device: { select: { roomId: true } } } },
      },
    }),
  ]);

  const subjectIds = [...new Set(liveSchedules.map((session) => session.subjectId))];
  const enrolments = subjectIds.length
    ? await prisma.subjectEnrolment.groupBy({
        by: ['subjectId'],
        where: { status: 'ACTIVE', subjectId: { in: subjectIds } },
        _count: { _all: true },
      })
    : [];
  const peopleBySubject = new Map(enrolments.map((row) => [row.subjectId, row._count._all]));

  const byRoom = new Map<string, RoomOccupancy>();
  for (const room of rooms) {
    byRoom.set(room.id, { roomId: room.id, occupied: false, people: 0, source: 'none', isDemo: false });
  }

  for (const session of liveSchedules) {
    if (!session.roomId) continue;
    const current = byRoom.get(session.roomId);
    if (!current) continue;
    byRoom.set(session.roomId, {
      roomId: session.roomId,
      occupied: true,
      people: current.people + (peopleBySubject.get(session.subjectId) ?? 0),
      source: 'schedule',
      isDemo: false,
    });
  }

  const seen = new Set<string>();
  for (const reading of latestReadings) {
    const metric = reading.sensor.metric;
    if (metric !== 'occupancy' && metric !== 'people') continue;
    const roomId = reading.sensor.device.roomId;
    if (!roomId) continue;
    const key = `${roomId}:${metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = byRoom.get(roomId);
    if (!current || current.source === 'schedule') continue;
    const people = Math.max(0, Math.round(reading.value));
    if (people <= 0) continue;
    byRoom.set(roomId, {
      roomId,
      occupied: true,
      people: metric === 'people' ? people : Math.max(current.people, people),
      source: 'sensor',
      isDemo: reading.isDemo,
    });
  }

  const occupied = [...byRoom.values()].filter((row) => row.occupied);
  const occupancyPeople = occupied.reduce((sum, row) => sum + row.people, 0);
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0) || 1;
  const occupiedCapacity = occupied.reduce((sum, row) => {
    const room = rooms.find((item) => item.id === row.roomId);
    return sum + (row.people > 0 ? Math.min(row.people, room?.capacity ?? row.people) : room?.capacity ?? 0);
  }, 0);

  return {
    byRoom,
    occupancyPeople,
    occupancyPercent: Math.round((occupiedCapacity / totalCapacity) * 1000) / 10,
    occupancyIsDemo: occupied.length > 0 && occupied.every((row) => row.isDemo),
  };
}
