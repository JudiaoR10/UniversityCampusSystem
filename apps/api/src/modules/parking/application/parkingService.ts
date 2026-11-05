import type { CreatePlateReadingInput, IngestPlateReadingInput, UpdateParkingSpotInput } from '@smart-campus/validation';
import { normalizeMozambiquePlate } from '@smart-campus/validation';
import { notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

export async function getParkingOverview() {
  const lots = await prisma.parkingLot.findMany({
    include: {
      spots: { orderBy: [{ rowLabel: 'asc' }, { code: 'asc' }] },
      _count: { select: { readings: true } },
    },
    orderBy: { code: 'asc' },
  });

  return lots.map((lot) => {
    const free = lot.spots.filter((s) => s.status === 'FREE').length;
    const occupied = lot.spots.filter((s) => s.status === 'OCCUPIED').length;
    const reserved = lot.spots.filter((s) => s.status === 'RESERVED').length;
    const out = lot.spots.filter((s) => s.status === 'OUT_OF_SERVICE').length;
    return {
      id: lot.id,
      code: lot.code,
      name: lot.name,
      description: lot.description,
      capacity: lot.capacity,
      free,
      occupied,
      reserved,
      outOfService: out,
      occupancyPercent: lot.capacity > 0 ? Math.round((occupied / lot.capacity) * 1000) / 10 : 0,
      readingsCount: lot._count.readings,
      spots: lot.spots.map((s) => ({
        id: s.id,
        code: s.code,
        rowLabel: s.rowLabel,
        level: s.level,
        status: s.status,
        plate: s.plate,
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  });
}

export async function listPlateReadings(limit = 30) {
  const readings = await prisma.plateReading.findMany({
    orderBy: { recordedAt: 'desc' },
    take: Math.min(limit, 100),
    include: {
      lot: { select: { id: true, code: true, name: true } },
      spot: { select: { id: true, code: true } },
    },
  });
  return readings.map((r) => ({
    id: r.id,
    plate: r.plate,
    direction: r.direction,
    confidence: r.confidence,
    photoUrl: r.photoUrl,
    sensorCode: r.sensorCode,
    isDemo: r.isDemo,
    lot: r.lot,
    spot: r.spot,
    recordedAt: r.recordedAt.toISOString(),
  }));
}

export async function ingestPlateReading(
  input: IngestPlateReadingInput,
  actorId: string | null,
  correlationId: string,
  sensorCode: string,
) {
  const lot = input.lotId
    ? await prisma.parkingLot.findUnique({ where: { id: input.lotId } })
    : await prisma.parkingLot.findUnique({ where: { code: input.lotCode } });
  if (!lot) throw notFound('PARKING_LOT_NOT_FOUND', 'Parque não encontrado');

  return createPlateReading(
    {
      lotId: lot.id,
      plate: input.plate,
      direction: input.direction,
      sensorCode: input.sensorCode ?? sensorCode,
      confidence: input.confidence ?? 0.9,
      photoUrl: input.photoUrl,
      spotCode: input.spotCode,
      isDemo: false,
    },
    actorId,
    correlationId,
  );
}

export async function createPlateReading(
  input: CreatePlateReadingInput,
  actorId: string | null,
  correlationId: string,
) {
  const lot = await prisma.parkingLot.findUnique({ where: { id: input.lotId } });
  if (!lot) throw notFound('PARKING_LOT_NOT_FOUND', 'Parque não encontrado');

  const plate = normalizeMozambiquePlate(input.plate);

  let spot =
    input.spotCode != null
      ? await prisma.parkingSpot.findFirst({ where: { lotId: lot.id, code: input.spotCode } })
      : null;

  if (input.direction === 'IN' && !spot) {
    spot = await prisma.parkingSpot.findFirst({
      where: { lotId: lot.id, status: 'FREE' },
      orderBy: { code: 'asc' },
    });
  }

  if (input.direction === 'IN' && spot) {
    await prisma.parkingSpot.update({
      where: { id: spot.id },
      data: { status: 'OCCUPIED', plate },
    });
  }

  if (input.direction === 'OUT') {
    const occupied = await prisma.parkingSpot.findFirst({
      where: {
        lotId: lot.id,
        plate,
        status: 'OCCUPIED',
      },
    });
    if (occupied) {
      spot = occupied;
      await prisma.parkingSpot.update({
        where: { id: occupied.id },
        data: { status: 'FREE', plate: null },
      });
    }
  }

  const reading = await prisma.plateReading.create({
    data: {
      lotId: lot.id,
      spotId: spot?.id,
      plate,
      direction: input.direction,
      confidence: input.confidence ?? 0.9,
      photoUrl: input.photoUrl ?? null,
      sensorCode: input.sensorCode ?? 'CAM-LPR-SIM',
      isDemo: input.isDemo ?? true,
    },
    include: {
      lot: { select: { id: true, code: true, name: true } },
      spot: { select: { id: true, code: true } },
    },
  });

  await audit({
    action: 'PARKING_PLATE_READING',
    resource: 'PlateReading',
    resourceId: reading.id,
    actorId,
    correlationId,
    metadata: { plate: reading.plate, direction: reading.direction, spot: spot?.code },
  });

  return {
    id: reading.id,
    plate: reading.plate,
    direction: reading.direction,
    confidence: reading.confidence,
    photoUrl: reading.photoUrl,
    sensorCode: reading.sensorCode,
    isDemo: reading.isDemo,
    lot: reading.lot,
    spot: reading.spot,
    recordedAt: reading.recordedAt.toISOString(),
  };
}

export async function updateParkingSpot(
  id: string,
  input: UpdateParkingSpotInput,
  actorId: string,
  correlationId: string,
) {
  const existing = await prisma.parkingSpot.findUnique({ where: { id } });
  if (!existing) throw notFound('PARKING_SPOT_NOT_FOUND', 'Vaga não encontrada');

  const plate = input.plate ? normalizeMozambiquePlate(input.plate) : null;

  const spot = await prisma.parkingSpot.update({
    where: { id },
    data: {
      status: input.status,
      plate: input.status === 'FREE' ? null : plate ?? existing.plate,
    },
  });

  await audit({
    action: 'PARKING_SPOT_UPDATE',
    resource: 'ParkingSpot',
    resourceId: spot.id,
    actorId,
    correlationId,
    metadata: { from: existing.status, to: spot.status, plate: spot.plate },
  });

  return {
    id: spot.id,
    code: spot.code,
    rowLabel: spot.rowLabel,
    level: spot.level,
    status: spot.status,
    plate: spot.plate,
    updatedAt: spot.updatedAt.toISOString(),
  };
}
