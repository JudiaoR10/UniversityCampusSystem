const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Parse .env manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const prisma = new PrismaClient();

const studentsToRegister = [
  { fullName: 'Avelino Mucare Júnior', email: 'avelinojunior@gmail.com' },
  { fullName: 'Albano João Gujamo', email: 'albanogujamo@gmail.com' },
  { fullName: 'Ana Francina Chauque', email: 'anachauque@gmail.com' },
  { fullName: 'Adylan Adriano Cumbane', email: 'adylancumbane@gmail.com' },
  { fullName: 'Alcino Timóteo Sibanda', email: 'alcinosibanda@gmail.com' },
  { fullName: 'Shelton Carlos Ricotso', email: 'sheltonricotso@gmail.com' },
  { fullName: 'Edson Maurício', email: 'edsonmauricio@gmail.com' },
  { fullName: 'Marlon Baptista Muchanga', email: 'marlonmuchanga@gmail.com' },
  { fullName: 'Paula Ubisse', email: 'paulaubisse@gmail.com' },
  { fullName: 'Jaqueline Canaíba', email: 'jaquelinecanaiba@gmail.com' },
  { fullName: 'Paulino Tomé', email: 'paulinotome@gmail.com' },
  { fullName: 'Antônio Elidio Costa', email: 'antoniocosta@gmail.com' },
  { fullName: 'Karen Mahanha', email: 'karenmahanha@gmail.com' },
  { fullName: 'Tiago Manuel Dava', email: 'tiagodava@gmail.com' },
  { fullName: 'Raul Poeira', email: 'raulpoeira@gmail.com' },
  { fullName: 'Kayky Pinto', email: 'kaykypinto@gmail.com' },
  { fullName: 'Emerson Gove', email: 'emersongove@gmail.com' },
  { fullName: 'Darwin Ouana', email: 'darwinouana@gmail.com' },
  { fullName: 'Osório Malloa', email: 'osoriomalloa@gmail.com' },
  { fullName: 'Shelzia Jessiana Lima Matsinhe', email: 'shelziamatsinhe@gmail.com' },
];

async function main() {
  console.log('--- A iniciar registo de estudantes ---');

  // 1. Obter role STUDENT
  const role = await prisma.role.findUnique({ where: { code: 'STUDENT' } });
  if (!role) throw new Error('Role STUDENT não encontrado.');

  // 2. Obter curso LEI (Engenharia Informática)
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { code: 'LEI' },
        { name: { contains: 'Engenharia Informática', mode: 'insensitive' } },
      ],
    },
  });
  if (!course) throw new Error('Curso de Engenharia Informática não encontrado.');
  console.log(`Curso encontrado: ${course.code} - ${course.name} (${course.id})`);

  // 3. Encontrar último número de estudante
  const existingStudents = await prisma.studentProfile.findMany({
    select: { studentNumber: true },
    orderBy: { studentNumber: 'desc' },
  });

  let maxNum = 0;
  for (const s of existingStudents) {
    const match = s.studentNumber && s.studentNumber.match(/EST-2026-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  console.log(`Último número de estudante existente: EST-2026-${String(maxNum).padStart(3, '0')}`);

  // 4. Hash da senha
  const passwordHash = await bcrypt.hash('smart1234', 10);

  // 5. Registar cada estudante
  const createdList = [];
  for (let i = 0; i < studentsToRegister.length; i++) {
    const item = studentsToRegister[i];
    const nextSeq = maxNum + 1 + i;
    const studentNumber = `EST-2026-${String(nextSeq).padStart(3, '0')}`;

    // Verificar se já existe utilizador com este email
    let user = await prisma.user.findUnique({ where: { email: item.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: item.email,
          fullName: item.fullName,
          passwordHash,
          roleId: role.id,
          isActive: true,
        },
      });
    }

    // Criar perfil de estudante
    let profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await prisma.studentProfile.create({
        data: {
          userId: user.id,
          studentNumber,
          courseId: course.id,
          yearOfStudy: 2,
          status: 'ACTIVE',
        },
      });

      await prisma.auditEvent.create({
        data: {
          action: 'STUDENT_PROFILE_CREATED',
          resource: 'StudentProfile',
          resourceId: profile.id,
          actorId: user.id,
          correlationId: `seed-${Date.now()}-${i}`,
          metadata: {
            studentNumber,
            courseCode: course.code,
            yearOfStudy: 2,
          },
        },
      });
    }

    createdList.push({
      studentNumber: profile.studentNumber,
      fullName: user.fullName,
      email: user.email,
      course: course.code,
      year: profile.yearOfStudy,
    });
  }

  console.log('\n=== ESTUDANTES REGISTADOS COM SUCESSO ===');
  console.table(createdList);
}

main()
  .catch((e) => {
    console.error('Erro ao registar estudantes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
