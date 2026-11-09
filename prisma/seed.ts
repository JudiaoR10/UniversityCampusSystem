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

  // ---------------------------------------------------------------------------
  // Dados reais — Edital de Admissão aos cursos de Graduação da UJAC (ano lectivo 2026)
  // Unidades orgânicas (Faculdade e Institutos) modeladas como Department.
  // O schema não tem campos para vagas/regime/mensalidade; ficam na descrição.
  // Taxas gerais do edital: inscrição 800,00 MT · matrícula 3.000,00 MT.
  // ---------------------------------------------------------------------------
  const unidadesUjac = [
    {
      code: 'FACISH',
      name: 'Faculdade de Ciências Sociais e Humanas',
      description: 'Unidade orgânica da UJAC. Mensalidade: 5.000,00 MT.',
    },
    {
      code: 'ISET',
      name: 'Instituto Superior de Engenharias e Tecnologias',
      description: 'Unidade orgânica da UJAC. Mensalidade: 8.500,00 MT.',
    },
    {
      code: 'ISCEG',
      name: 'Instituto Superior de Ciências Económicas e de Gestão',
      description: 'Unidade orgânica da UJAC. Mensalidade: 6.500,00 MT.',
    },
  ];

  const unidadeIds: Record<string, string> = {};
  for (const unidade of unidadesUjac) {
    const registo = await prisma.department.upsert({
      where: { code: unidade.code },
      update: { name: unidade.name, description: unidade.description },
      create: unidade,
    });
    unidadeIds[unidade.code] = registo.id;
  }

  const vagas = 'Vagas: 35 no período matutino e 35 no vespertino (total 70).';
  const posLaboral = ' Regime: Pós-Laboral (On-line).';
  const cursosUjac = [
    {
      code: 'LCE',
      unidade: 'FACISH',
      name: 'Licenciatura em Ciências da Educação',
      description:
        'Habilidade em: Gestão de Projectos Educativos; Educação de Infância; Tecnologia Educacional. ' +
        vagas +
        posLaboral,
    },
    {
      code: 'LEI',
      unidade: 'ISET',
      name: 'Licenciatura em Engenharia Informática',
      description: vagas,
    },
    {
      code: 'LIACD',
      unidade: 'ISET',
      name: 'Licenciatura em Inteligência Artificial e Ciência de Dados',
      description: vagas,
    },
    {
      code: 'LGE',
      unidade: 'ISCEG',
      name: 'Licenciatura em Gestão de Empresas',
      description: 'Habilitação em: Transporte e Logística; Ciências Atuariais. ' + vagas + posLaboral,
    },
    {
      code: 'LCA',
      unidade: 'ISCEG',
      name: 'Licenciatura em Contabilidade e Auditoria',
      description: vagas,
    },
    {
      code: 'LGFB',
      unidade: 'ISCEG',
      name: 'Licenciatura em Gestão Financeira e Bancária',
      description: vagas,
    },
    {
      code: 'LGRH',
      unidade: 'ISCEG',
      name: 'Licenciatura em Gestão de Recursos Humanos',
      description: vagas + posLaboral,
    },
  ];

  // O curso demo LEI é a mesma Engenharia Informática do edital: passa para o ISET em vez de duplicar.
  for (const curso of cursosUjac) {
    const dados = {
      name: curso.name,
      description: curso.description,
      departmentId: unidadeIds[curso.unidade],
    };
    await prisma.course.upsert({
      where: { code: curso.code },
      update: dados,
      create: { code: curso.code, ...dados },
    });
  }

  // Disciplinas de Engenharia Informática (LEI). A PTP3 já foi criada acima.
  const cursoLei = await prisma.course.findUniqueOrThrow({ where: { code: 'LEI' } });
  const disciplinasLei = [
    { code: 'LP', name: 'Linguagem de Programação', credits: 1 },
    { code: 'MD', name: 'Matemática Discreta', credits: 5 },
    { code: 'MN', name: 'Métodos Numéricos', credits: 4 },
    { code: 'PE', name: 'Probabilidade e Estatística', credits: 8 },
    { code: 'RC', name: 'Redes de Comunicação', credits: 7 },
    { code: 'SD', name: 'Sistemas Distribuídos', credits: 3 },
    { code: 'SGDB', name: 'Gestão e Administração de Base de Dados', credits: 2 },
  ];
  for (const disciplina of disciplinasLei) {
    await prisma.subject.upsert({
      where: { code: disciplina.code },
      update: { name: disciplina.name, credits: disciplina.credits, courseId: cursoLei.id },
      create: { ...disciplina, courseId: cursoLei.id },
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
    update: { status: 'ACTIVE' },
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

  await prisma.externalEmployee.upsert({
    where: { employeeCode: 'LIM-001' },
    update: { fullName: 'Ana Serviços', category: 'CLEANER', jobTitle: 'Agente de limpeza', isActive: true },
    create: { employeeCode: 'LIM-001', fullName: 'Ana Serviços', category: 'CLEANER', jobTitle: 'Agente de limpeza' },
  });
  await prisma.externalEmployee.upsert({
    where: { employeeCode: 'GRD-001' },
    update: { fullName: 'Carlos Segurança', category: 'GUARD', jobTitle: 'Guarda', isActive: true },
    create: { employeeCode: 'GRD-001', fullName: 'Carlos Segurança', category: 'GUARD', jobTitle: 'Guarda' },
  });

  const studentA = await prisma.studentProfile.findUnique({ where: { userId: studentAId } });
  const studentB = await prisma.studentProfile.findUnique({ where: { userId: studentBId } });

  if (studentB) {
    await prisma.subjectEnrolment.upsert({
      where: {
        studentId_subjectId_academicYear: {
          studentId: studentB.id,
          subjectId: subject.id,
          academicYear: 2026,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        studentId: studentB.id,
        subjectId: subject.id,
        academicYear: 2026,
        status: 'ACTIVE',
      },
    });
  }

  if (studentA) {
    await prisma.enrolment.upsert({
      where: { studentId_courseId_academicYear: { studentId: studentA.id, courseId: course.id, academicYear: '2026' } },
      update: { status: 'ACTIVE' },
      create: { studentId: studentA.id, courseId: course.id, academicYear: '2026', status: 'ACTIVE' },
    });
  }
  if (studentB) {
    await prisma.enrolment.upsert({
      where: { studentId_courseId_academicYear: { studentId: studentB.id, courseId: course.id, academicYear: '2026' } },
      update: { status: 'ACTIVE' },
      create: { studentId: studentB.id, courseId: course.id, academicYear: '2026', status: 'ACTIVE' },
    });
  }

  // ---------------------------------------------------------------------------
  // Perfis académicos registados na aplicação.
  // Versionados para que qualquer pessoa que atualize o Core e corra o seed os
  // receba. Upsert por matrícula/código de docente: nunca duplica nem apaga.
  // As contas usam a palavra-passe de demonstração indicada no fim do seed; a
  // palavra-passe original não é recuperável porque só existe a hash local.
  // ---------------------------------------------------------------------------
  const estudantesRegistados = [
    { studentNumber: 'EST-2026-003', fullName: 'Belvina Luisa Ualuto', email: 'belvinaualuto@gmail.com' },
    { studentNumber: 'EST-2026-004', fullName: 'Mirson Maluve', email: 'mirsonmaluve@gmail.com' },
    { studentNumber: 'EST-2026-005', fullName: 'Aura David', email: 'auradavid@gmail.com' },
    { studentNumber: 'EST-2026-006', fullName: 'Alípio Anderson Paco', email: 'alipiopaco@gmail.com' },
    { studentNumber: 'EST-2026-007', fullName: 'Jocar Celio Elias', email: 'jocarcelio@gmail.com' },
    { studentNumber: 'EST-2026-008', fullName: 'Clay José Chidudo', email: 'clayjose@gmail.com' },
  ];

  const docentesRegistados = [
    { employeeCode: 'DOC-102', fullName: 'Armando Correia', email: 'armandocorreia@gmail.com', title: 'Docente' },
    { employeeCode: 'DOC-103', fullName: 'Cidália da Camara', email: 'cidalia@gmail.com', title: 'Docente' },
    { employeeCode: 'DOC-104', fullName: 'Carsolimo Sambo', email: 'carsolino@gmail.com', title: 'Docente' },
  ];

  for (const estudante of estudantesRegistados) {
    const existente = await prisma.studentProfile.findUnique({ where: { studentNumber: estudante.studentNumber } });
    if (existente) continue;

    const user = await prisma.user.upsert({
      where: { email: estudante.email },
      update: { fullName: estudante.fullName, roleId: roleMap['STUDENT'] },
      create: {
        email: estudante.email,
        fullName: estudante.fullName,
        passwordHash: await hash('Estudante123!'),
        roleId: roleMap['STUDENT'],
      },
    });

    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        studentNumber: estudante.studentNumber,
        courseId: cursoLei.id,
        yearOfStudy: 3,
        status: 'ACTIVE',
      },
    });
  }

  for (const docente of docentesRegistados) {
    const existente = await prisma.teacherProfile.findUnique({ where: { employeeCode: docente.employeeCode } });
    if (existente) continue;

    const user = await prisma.user.upsert({
      where: { email: docente.email },
      update: { fullName: docente.fullName, roleId: roleMap['TEACHER'] },
      create: {
        email: docente.email,
        fullName: docente.fullName,
        passwordHash: await hash('Docente123!'),
        roleId: roleMap['TEACHER'],
      },
    });

    await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        employeeCode: docente.employeeCode,
        departmentId: dept.id,
        title: docente.title,
        status: 'ACTIVE',
      },
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

  const buildingD2 = await prisma.building.upsert({
    where: { code: 'D2' },
    update: { name: 'Edifício D2 - UJAC', description: 'Edifício principal da UJAC', floors: 2, mapX: 48, mapY: 46 },
    create: { code: 'D2', name: 'Edifício D2 - UJAC', floors: 2, description: 'Edifício principal da UJAC', mapX: 48, mapY: 46 },
  });

  // Piso 1
  await prisma.room.upsert({ where: { code: 'D2-101' }, update: {}, create: { code: 'D2-101', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-102' }, update: {}, create: { code: 'D2-102', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-103' }, update: {}, create: { code: 'D2-103', name: 'Sala dos Professores', capacity: 15, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-104' }, update: {}, create: { code: 'D2-104', name: 'Gabinete de Apoio ao Estudante', capacity: 12, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-105' }, update: {}, create: { code: 'D2-105', name: 'Laboratório', capacity: 25, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-106' }, update: {}, create: { code: 'D2-106', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-107' }, update: {}, create: { code: 'D2-107', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-108' }, update: {}, create: { code: 'D2-108', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-109' }, update: {}, create: { code: 'D2-109', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-110' }, update: {}, create: { code: 'D2-110', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-111' }, update: {}, create: { code: 'D2-111', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-112' }, update: {}, create: { code: 'D2-112', name: 'Sala de Aula', capacity: 40, floor: 1, status: 'AVAILABLE', buildingId: buildingD2.id } });

  // Piso 2
  await prisma.room.upsert({ where: { code: 'D2-201' }, update: {}, create: { code: 'D2-201', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-202' }, update: {}, create: { code: 'D2-202', name: 'Sala de Coordenação dos Cursos (ISCEG, ISET, FACISH)', capacity: 15, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-203' }, update: {}, create: { code: 'D2-203', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-204' }, update: {}, create: { code: 'D2-204', name: 'Laboratório de Informática', capacity: 25, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-205' }, update: {}, create: { code: 'D2-205', name: 'Laboratório', capacity: 25, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-206' }, update: {}, create: { code: 'D2-206', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-207' }, update: {}, create: { code: 'D2-207', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-207A' }, update: {}, create: { code: 'D2-207A', name: 'Sala de Aula', capacity: 30, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-208' }, update: {}, create: { code: 'D2-208', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-209' }, update: {}, create: { code: 'D2-209', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-210' }, update: {}, create: { code: 'D2-210', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-211' }, update: {}, create: { code: 'D2-211', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-212' }, update: {}, create: { code: 'D2-212', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });
  await prisma.room.upsert({ where: { code: 'D2-213' }, update: {}, create: { code: 'D2-213', name: 'Sala de Aula', capacity: 40, floor: 2, status: 'AVAILABLE', buildingId: buildingD2.id } });

  const roomD2101 = await prisma.room.findUnique({ where: { code: 'D2-101' } });
  if (!roomD2101) {
    throw new Error('D2-101 não encontrado após criação das salas do edifício D2');
  }

  const device = await prisma.device.upsert({
    where: { code: 'ESP32-A101-01' },
    update: {
      name: 'Sensor ambiental D2-101',
      roomId: roomD2101.id,
      mqttTopic: 'campus/d2/d2-101/env',
    },
    create: {
      code: 'ESP32-A101-01',
      name: 'Sensor ambiental D2-101',
      type: 'ESP32',
      status: 'ONLINE',
      roomId: roomD2101.id,
      mqttTopic: 'campus/d2/d2-101/env',
    },
  });

  await prisma.device.upsert({
    where: { code: 'CAM-LPR-D2-01' },
    update: { ingestToken: 'dev-lpr-cam-01', name: 'Câmara LPR D2' },
    create: {
      code: 'CAM-LPR-D2-01',
      name: 'Câmara LPR D2',
      type: 'LPR_CAMERA',
      status: 'ONLINE',
      ingestToken: 'dev-lpr-cam-01',
    },
  });

  const tempSensor = await prisma.sensor.upsert({
    where: { code: 'TEMP-A101' },
    update: { warningMin: 18, warningMax: 27, criticalMax: 32 },
    create: {
      code: 'TEMP-A101',
      name: 'Temperatura D2-101',
      metric: 'temperature',
      unit: '°C',
      deviceId: device.id,
      warningMin: 18,
      warningMax: 27,
      criticalMax: 32,
    },
  });

  await prisma.sensor.upsert({
    where: { code: 'HUM-A101' },
    update: { warningMin: 30, warningMax: 65, deviceId: device.id },
    create: {
      code: 'HUM-A101',
      name: 'Humidade D2-101',
      metric: 'humidity',
      unit: '%',
      deviceId: device.id,
      warningMin: 30,
      warningMax: 65,
    },
  });

  await prisma.sensor.upsert({
    where: { code: 'CO2-A101' },
    update: { warningMax: 800, criticalMax: 1000, deviceId: device.id },
    create: {
      code: 'CO2-A101',
      name: 'CO₂ D2-101',
      metric: 'co2',
      unit: 'ppm',
      deviceId: device.id,
      warningMax: 800,
      criticalMax: 1000,
    },
  });

  await prisma.sensor.upsert({
    where: { code: 'OCC-D2101' },
    update: { deviceId: device.id },
    create: {
      code: 'OCC-D2101',
      name: 'Ocupação D2-101',
      metric: 'occupancy',
      unit: 'pessoas',
      deviceId: device.id,
    },
  });
  await prisma.sensor.upsert({
    where: { code: 'PPL-D2101' },
    update: { deviceId: device.id },
    create: {
      code: 'PPL-D2101',
      name: 'Pessoas D2-101',
      metric: 'people',
      unit: 'pessoas',
      deviceId: device.id,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'parkingLabMode' },
    update: {},
    create: { key: 'parkingLabMode', value: 'false' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'tempWarningMax' },
    update: {},
    create: { key: 'tempWarningMax', value: '27' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'co2WarningMax' },
    update: {},
    create: { key: 'co2WarningMax', value: '800' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'co2CriticalMax' },
    update: {},
    create: { key: 'co2CriticalMax', value: '1000' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'readingRetentionDays' },
    update: {},
    create: { key: 'readingRetentionDays', value: '30' },
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

  const existingSpots = await prisma.parkingSpot.count({ where: { lotId: lot.id } });
  if (existingSpots === 0) {
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

  const existingReadings = await prisma.plateReading.count({ where: { lotId: lot.id } });
  if (existingReadings === 0) {
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

  if (studentA) {
    await prisma.debt.upsert({
      where: { code: 'DEMO-PROP-2026' },
      update: {},
      create: {
        code: 'DEMO-PROP-2026',
        studentId: studentA.userId,
        title: 'Propina 1.º semestre 2026',
        amount: 8500,
        origin: 'TUITION',
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: 'PENDENTE',
      },
    });
  }
  const teacherCompensation = await prisma.employeeCompensation.upsert({
    where: { userId: teacherId },
    update: {},
    create: { userId: teacherId, currentAmount: 45000, approvedAt: new Date() },
  });
  const month = new Date().toISOString().slice(0, 7);
  await prisma.employeeSalary.upsert({
      where: { compensationId_month: { compensationId: teacherCompensation.id, month } },
      update: {},
      create: {
        compensationId: teacherCompensation.id,
        month,
        amount: 45000,
        notes: 'Salário de demonstração',
        status: 'PENDING',
      },
    });

  const dayMs = 24 * 60 * 60 * 1000;
  const liveStarts = new Date(Date.now() - 15 * 60 * 1000);
  const liveEnds = new Date(Date.now() + 75 * 60 * 1000);
  const liveTitle = 'Aula PTP3 — sessão em curso';
  const live = await prisma.classSchedule.findFirst({ where: { title: liveTitle } });
  if (live) {
    await prisma.classSchedule.update({
      where: { id: live.id },
      data: { startsAt: liveStarts, endsAt: liveEnds, roomId: roomD2101.id, subjectId: subject.id },
    });
  } else {
    await prisma.classSchedule.create({
      data: {
        title: liveTitle,
        subjectId: subject.id,
        courseId: course.id,
        teacherId,
        roomId: roomD2101.id,
        startsAt: liveStarts,
        endsAt: liveEnds,
      },
    });
  }

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
          roomId: roomD2101.id,
          startsAt: spec.startsAt,
          endsAt: spec.endsAt,
        },
      });
    }
  }

  console.log('Seed concluído.');
  console.log('Credenciais de demonstração (apenas desenvolvimento):');
  console.log('  financas@smartcampus.demo / Finance123!');
  console.log('  admin@smartcampus.demo / Admin123!');
  console.log('  coordenador@smartcampus.demo / Coord123!');
  console.log('  docente@smartcampus.demo / Docente123!');
  console.log('  docente2@smartcampus.demo / Docente123!');
  console.log('  tecnico@smartcampus.demo / Tecnico123!');
  console.log('  estudante@smartcampus.demo / Estudante123!');
  console.log('  estudante2@smartcampus.demo / Estudante123!');
  console.log('  Perfis partilhados: EST-2026-003..008 / Estudante123! · DOC-102..104 / Docente123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });