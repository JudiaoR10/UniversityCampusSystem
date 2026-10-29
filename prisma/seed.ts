import { PrismaClient, RoleCode } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(password: string) {
  // Custo 12, alinhado com BCRYPT_ROUNDS do authService.
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('A semear Smart Campus...');

  const roles: Array<{ code: RoleCode; name: string; description: string }> = [
    { code: 'STUDENT', name: 'Estudante', description: 'Acesso académico básico' },
    { code: 'TEACHER', name: 'Docente', description: 'Acesso lectivo e consulta' },
    { code: 'TECHNICIAN', name: 'Técnico', description: 'Infraestrutura e ocorrências' },
    { code: 'COORDINATOR', name: 'Coordenador', description: 'Coordenação de área' },
    { code: 'FINANCE', name: 'Tesouraria', description: 'Gestão financeira de estudantes' },
    { code: 'ADMIN', name: 'Administrador', description: 'Administração completa' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }

  const roleMap = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.id]));

  const users = [
    { email: 'financas@smartcampus.demo', fullName: 'Tesouraria Demo', role: 'FINANCE' as RoleCode, password: 'Finance123!' },
    { email: 'admin@smartcampus.demo', fullName: 'Admin Demo', role: 'ADMIN' as RoleCode, password: 'Admin123!' },
    { email: 'coordenador@smartcampus.demo', fullName: 'Coordenador Demo', role: 'COORDINATOR' as RoleCode, password: 'Coord123!' },
    { email: 'docente@smartcampus.demo', fullName: 'Docente Demo', role: 'TEACHER' as RoleCode, password: 'Docente123!' },
    { email: 'docente2@smartcampus.demo', fullName: 'Docente Dois Demo', role: 'TEACHER' as RoleCode, password: 'Docente123!' },
    { email: 'tecnico@smartcampus.demo', fullName: 'Técnico Demo', role: 'TECHNICIAN' as RoleCode, password: 'Tecnico123!' },
    { email: 'estudante@smartcampus.demo', fullName: 'Estudante Demo', role: 'STUDENT' as RoleCode, password: 'Estudante123!' },
    { email: 'estudante2@smartcampus.demo', fullName: 'Estudante Dois Demo', role: 'STUDENT' as RoleCode, password: 'Estudante123!' },
  ];

  const createdUsers: Record<string, string> = {};
  for (const u of users) {
    const passwordHash = await hash(u.password);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, passwordHash, roleId: roleMap[u.role], isActive: true },
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        roleId: roleMap[u.role],
      },
    });
    createdUsers[u.email] = user.id;
  }

  const adminId = createdUsers['admin@smartcampus.demo'];
  const teacherId = createdUsers['docente@smartcampus.demo'];
  const studentAId = createdUsers['estudante@smartcampus.demo'];
  const studentBId = createdUsers['estudante2@smartcampus.demo'];

  const dept = await prisma.department.upsert({
    where: { code: 'DEI' },
    update: {},
    create: {
      code: 'DEI',
      name: 'Departamento de Engenharia Informática',
      description: 'Departamento de demonstração',
    },
  });

  const course = await prisma.course.upsert({
    where: { code: 'LEI' },
    update: {},
    create: {
      code: 'LEI',
      name: 'Licenciatura em Engenharia Informática',
      description: 'Curso de demonstração',
      departmentId: dept.id,
    },
  });

  const subject = await prisma.subject.upsert({
    where: { code: 'PTP3' },
    update: {},
    create: {
      code: 'PTP3',
      name: 'Prática Técnico-Profissional III',
      credits: 6,
      courseId: course.id,
      requiredTestCount: 2,
    },
  });
  if (subject.requiredTestCount == null) {
    await prisma.subject.update({
      where: { id: subject.id },
      data: { requiredTestCount: 2 },
    });
  }
  // Critério de recorrência institucional (nota mínima de admissão 0–20).
  // Guardado: nunca sobrescreve um valor já definido na BD.
  if (subject.recurrenceMinAdmission == null) {
    await prisma.subject.update({
      where: { id: subject.id },
      data: { recurrenceMinAdmission: 7 },
    });
  }

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: studentAId },
    update: {},
    create: {
      userId: studentAId,
      studentNumber: 'EST-2026-001',
      courseId: course.id,
      yearOfStudy: 3,
      phone: '+258 84 000 0001',
      status: 'ACTIVE',
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: studentBId },
    update: {},
    create: {
      userId: studentBId,
      studentNumber: 'EST-2026-002',
      courseId: course.id,
      yearOfStudy: 3,
    },
  });

  await prisma.teacherProfile.upsert({
    where: { userId: teacherId },
    update: {},
    create: {
      userId: teacherId,
      employeeCode: 'DOC-100',
      departmentId: dept.id,
      title: 'Assistente',
      phone: '+258 84 000 0002',
      status: 'ACTIVE',
    },
  });

  await prisma.subjectEnrolment.upsert({
    where: {
      studentId_subjectId_academicYear: {
        studentId: studentProfile.id,
        subjectId: subject.id,
        academicYear: 2026,
      },
    },
    update: {},
    create: {
      studentId: studentProfile.id,
      subjectId: subject.id,
      academicYear: 2026,
      status: 'ACTIVE',
    },
  });

  await prisma.teacherProfile.upsert({
    where: { userId: createdUsers['docente2@smartcampus.demo'] },
    update: {},
    create: {
      userId: createdUsers['docente2@smartcampus.demo'],
      employeeCode: 'DOC-101',
      departmentId: dept.id,
    },
  });

  const studentA = await prisma.studentProfile.findUnique({ where: { userId: studentAId } });
  const studentB = await prisma.studentProfile.findUnique({ where: { userId: studentBId } });

  if (studentA) {
    await prisma.enrolment.upsert({
      where: { studentId_courseId_academicYear: { studentId: studentA.id, courseId: course.id, academicYear: '2026' } },
      update: {},
      create: { studentId: studentA.id, courseId: course.id, academicYear: '2026', status: 'ACTIVE' },
    });
  }
  if (studentB) {
    await prisma.enrolment.upsert({
      where: { studentId_courseId_academicYear: { studentId: studentB.id, courseId: course.id, academicYear: '2026' } },
      update: {},
      create: { studentId: studentB.id, courseId: course.id, academicYear: '2026', status: 'ACTIVE' },
    });
  }

  // Avaliações contínuas padrão da disciplina (o docente pode ajustar pesos depois).
  const defaultAssessments = [
    { title: 'Teste 1', weight: 50 },
    { title: 'Teste 2', weight: 50 },
  ];
  for (const def of defaultAssessments) {
    const existing = await prisma.assessment.findFirst({ where: { subjectId: subject.id, title: def.title } });
    if (!existing) {
      await prisma.assessment.create({
        data: {
          title: def.title,
          type: 'TEST',
          gradingMode: 'SCALE',
          maxScore: 20,
          weight: def.weight,
          subjectId: subject.id,
          createdById: teacherId,
        },
      });
    }
  }

  const buildingA = await prisma.building.upsert({
    where: { code: 'A' },
    update: {},
    create: { code: 'A', name: 'Edifício A — Ciências', floors: 3, description: 'Edifício principal de demonstração' },
  });

  const buildingB = await prisma.building.upsert({
    where: { code: 'B' },
    update: {},
    create: { code: 'B', name: 'Edifício B — Laboratórios', floors: 2 },
  });

  const roomA101 = await prisma.room.upsert({
    where: { code: 'A-101' },
    update: {},
    create: {
      code: 'A-101',
      name: 'Sala de Aula 101',
      capacity: 40,
      floor: 1,
      status: 'AVAILABLE',
      buildingId: buildingA.id,
    },
  });

  await prisma.room.upsert({
    where: { code: 'A-201' },
    update: {},
    create: {
      code: 'A-201',
      name: 'Sala de Aula 201',
      capacity: 30,
      floor: 2,
      status: 'AVAILABLE',
      buildingId: buildingA.id,
    },
  });

  const labRoom = await prisma.room.upsert({
    where: { code: 'B-L01' },
    update: {},
    create: {
      code: 'B-L01',
      name: 'Laboratório IoT',
      capacity: 20,
      floor: 1,
      status: 'AVAILABLE',
      buildingId: buildingB.id,
    },
  });

  await prisma.laboratory.upsert({
    where: { code: 'LAB-IOT' },
    update: {},
    create: {
      code: 'LAB-IOT',
      name: 'Laboratório de IoT',
      description: 'Espaço preparado para integração MQTT',
      buildingId: buildingB.id,
    },
  });

  const projector = await prisma.equipment.upsert({
    where: { code: 'EQ-PROJ-01' },
    update: {},
    create: {
      code: 'EQ-PROJ-01',
      name: 'Projector Epson',
      description: 'Projector da sala A-101',
      roomId: roomA101.id,
    },
  });

  const existingIncident = await prisma.incident.findFirst({
    where: { title: 'Projector sem imagem' },
  });
  if (!existingIncident) {
    await prisma.incident.create({
      data: {
        title: 'Projector sem imagem',
        description: 'O projector da sala A-101 não liga. Dados fictícios de demonstração.',
        status: 'OPEN',
        priority: 'MEDIUM',
        roomId: roomA101.id,
        equipmentId: projector.id,
        reporterId: studentAId,
      },
    });
  }

  const device = await prisma.device.upsert({
    where: { code: 'ESP32-A101-01' },
    update: {},
    create: {
      code: 'ESP32-A101-01',
      name: 'Sensor ambiental A-101',
      type: 'ESP32',
      status: 'ONLINE',
      roomId: roomA101.id,
      mqttTopic: 'campus/building-a/room-a101/env',
    },
  });

  const tempSensor = await prisma.sensor.upsert({
    where: { code: 'TEMP-A101' },
    update: {},
    create: {
      code: 'TEMP-A101',
      name: 'Temperatura A-101',
      metric: 'temperature',
      unit: '°C',
      deviceId: device.id,
    },
  });

  const readingCount = await prisma.reading.count({ where: { sensorId: tempSensor.id } });
  if (readingCount === 0) {
    await prisma.reading.createMany({
      data: [
        { sensorId: tempSensor.id, value: 24.5, isDemo: true },
        { sensorId: tempSensor.id, value: 25.1, isDemo: true },
        { sensorId: tempSensor.id, value: 23.8, isDemo: true },
      ],
    });
  }

  const alertCount = await prisma.alert.count();
  if (alertCount === 0) {
    await prisma.alert.create({
      data: {
        title: '[DEMO] Temperatura elevada',
        message: 'Alerta fictício de demonstração — sensor TEMP-A101',
        severity: 'WARNING',
        sensorId: tempSensor.id,
        isDemo: true,
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: adminId,
        title: 'Bem-vindo ao Smart Campus',
        body: 'Core inicial preparado para integração modular (PTP III).',
      },
    ],
    skipDuplicates: true,
  });

  const lot = await prisma.parkingLot.upsert({
    where: { code: 'PARK-B' },
    update: {},
    create: {
      code: 'PARK-B',
      name: 'Parque do Campus — Bloco B',
      description: 'Estacionamento de demonstração com sensores de vaga e câmaras LPR',
      capacity: 24,
    },
  });

  // Recria vagas/leituras para garantir matrículas moçambicanas de demonstração
  await prisma.plateReading.deleteMany({ where: { lotId: lot.id } });
  await prisma.parkingSpot.deleteMany({ where: { lotId: lot.id } });
  {
    const rows = ['A', 'B', 'C', 'D'];
    const occupiedPlates = [
      'AIT 954 MC',
      'AMH 722 MP',
      'MLY 72 22',
      'ABR 301 MC',
      'ADP 448 MP',
      'FGT 19 05',
    ];
    let plateIdx = 0;
    const spots = [];
    for (const row of rows) {
      for (let n = 1; n <= 6; n++) {
        const occupied = plateIdx < occupiedPlates.length && (n + row.charCodeAt(0)) % 3 === 0;
        const plate = occupied ? occupiedPlates[plateIdx++] : null;
        spots.push({
          code: `${row}${String(n).padStart(2, '0')}`,
          rowLabel: row,
          level: 0,
          status: occupied ? ('OCCUPIED' as const) : n === 6 && row === 'D' ? ('OUT_OF_SERVICE' as const) : ('FREE' as const),
          plate: plate,
          lotId: lot.id,
        });
      }
    }
    await prisma.parkingSpot.createMany({ data: spots });
  }

  {
    const occupied = await prisma.parkingSpot.findMany({
      where: { lotId: lot.id, status: 'OCCUPIED' },
      take: 5,
    });
    const demoPhotos = [
      'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
    ];
    for (let i = 0; i < occupied.length; i++) {
      const spot = occupied[i];
      await prisma.plateReading.create({
        data: {
          plate: spot.plate ?? 'AIT 954 MC',
          direction: 'IN',
          confidence: 0.91 + i * 0.01,
          photoUrl: demoPhotos[i % demoPhotos.length],
          sensorCode: 'CAM-LPR-B-01',
          isDemo: true,
          lotId: lot.id,
          spotId: spot.id,
          recordedAt: new Date(Date.now() - (i + 1) * 12 * 60_000),
        },
      });
    }
    await prisma.plateReading.create({
      data: {
        plate: 'AHK 883 MC',
        direction: 'OUT',
        confidence: 0.94,
        photoUrl: demoPhotos[0],
        sensorCode: 'CAM-LPR-B-02',
        isDemo: true,
        lotId: lot.id,
        recordedAt: new Date(Date.now() - 4 * 60_000),
      },
    });
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const scheduleSpecs = [
    {
      title: 'Aula PTP3 — Integración Tecnológica',
      startsAt: new Date(Date.now() + dayMs),
      endsAt: new Date(Date.now() + dayMs + 90 * 60 * 1000),
    },
    {
      title: 'Aula PTP3 — Projecto em grupo',
      startsAt: new Date(Date.now() + 3 * dayMs),
      endsAt: new Date(Date.now() + 3 * dayMs + 90 * 60 * 1000),
    },
  ];
  for (const spec of scheduleSpecs) {
    const exists = await prisma.classSchedule.findFirst({ where: { title: spec.title } });
    if (!exists) {
      await prisma.classSchedule.create({
        data: {
          title: spec.title,
          subjectId: subject.id,
          courseId: course.id,
          teacherId,
          roomId: roomA101.id,
          startsAt: spec.startsAt,
          endsAt: spec.endsAt,
        },
      });
    }
  }

  console.log('Seed concluído.');
  console.log('Credenciais de demonstração (apenas desenvolvimento):');
  console.log('  admin@smartcampus.demo / Admin123!');
  console.log('  coordenador@smartcampus.demo / Coord123!');
  console.log('  docente@smartcampus.demo / Docente123!');
  console.log('  docente2@smartcampus.demo / Docente123!');
  console.log('  tecnico@smartcampus.demo / Tecnico123!');
  console.log('  estudante@smartcampus.demo / Estudante123!');
  console.log('  estudante2@smartcampus.demo / Estudante123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
