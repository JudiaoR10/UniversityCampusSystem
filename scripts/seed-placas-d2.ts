import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function cuid(): string {
  return 'c' + Math.random().toString(36).substring(2, 18) + Date.now().toString(36);
}

async function main() {
  console.log('A preparar dados do edifício D2 (UJAC)...');

  await prisma.$transaction(async () => {
    // === 1. Criar salas em falta ===
    console.log('\n1. A criar salas em falta:');
    const missingRooms = [
      { code: 'D2-103', name: 'Sala D2-103', capacity: 30, floor: 1 },
      { code: 'D2-202', name: 'Sala D2-202', capacity: 30, floor: 2 },
      { code: 'D2-205', name: 'Sala D2-205', capacity: 30, floor: 2 },
      { code: 'D2-207A', name: 'Sala D2-207A', capacity: 20, floor: 2 },
    ];
    const BUILDING_D2_ID = 'cmvruu4va0000ygxwgh01wsb5';

    for (const room of missingRooms) {
      const existing = await prisma.$queryRaw`
        SELECT id FROM "Room" WHERE "code" = ${room.code} LIMIT 1
      `;
      if (Array.isArray(existing) && existing.length > 0) {
        console.log(`  Já existe: ${room.code}`);
      } else {
        await prisma.$queryRaw`
          INSERT INTO "Room" ("id", "code", "name", "capacity", "floor", "status", "buildingId", "createdAt", "updatedAt", "tem_placa")
          VALUES (${cuid()}, ${room.code}, ${room.name}, ${room.capacity}, ${room.floor}, 'AVAILABLE', ${BUILDING_D2_ID}, NOW(), NOW(), false)
        `;
        console.log(`  Criada: ${room.code} (piso ${room.floor})`);
      }
    }

    // === 2. Inserir placas ===
    console.log('\n2. A inserir placas:');

    const placas = [
      { tipo: 'PORTA', edificio: 'D2', piso: 1, sala_codigo: 'D2-101', texto_principal: null, linhas_texto: JSON.stringify(['D2-101', 'SALA DE AULA']), etiqueta_preta: 'D2: 101', direcao: null, observacoes: null },
      { tipo: 'PORTA', edificio: 'D2', piso: 1, sala_codigo: 'D2-103', texto_principal: null, linhas_texto: JSON.stringify(['SALA D2-103', 'PROFESSORES']), etiqueta_preta: 'D2: 103', direcao: null, observacoes: null },
      { tipo: 'PORTA', edificio: 'D2', piso: 1, sala_codigo: 'D2-104', texto_principal: null, linhas_texto: JSON.stringify(['ALA D2-104', 'SERVIÇOS DE APOIO AO ESTUDANTE']), etiqueta_preta: 'D2: 104', direcao: null, observacoes: "a placa da porta diz 'Serviços de Apoio ao Estudante'; a placa direcional do piso 1 diz 'Gabinete de Apoio ao Estudante' (provavelmente o mesmo local)" },
      { tipo: 'PORTA', edificio: 'D2', piso: 2, sala_codigo: 'D2-201', texto_principal: null, linhas_texto: JSON.stringify(['D2-201', 'SALA DE AULA']), etiqueta_preta: 'D2: 201', direcao: null, observacoes: null },
      { tipo: 'PORTA', edificio: 'D2', piso: 2, sala_codigo: 'D2-202', texto_principal: null, linhas_texto: JSON.stringify(['SALA D2-202', 'SALA DE COORDENAÇÃO DOS CURSOS', 'ISCEG | ISET | FACISH']), etiqueta_preta: 'D2: 202', direcao: null, observacoes: null },
      { tipo: 'PORTA', edificio: 'D2', piso: 2, sala_codigo: 'D2-203', texto_principal: null, linhas_texto: JSON.stringify(['D2-203', 'SALA DE AULA']), etiqueta_preta: 'D2: 203', direcao: null, observacoes: null },
      { tipo: 'PORTA', edificio: 'D2', piso: 2, sala_codigo: 'D2-204', texto_principal: null, linhas_texto: JSON.stringify(['SALA D2-204', 'INFORMÁTICA']), etiqueta_preta: 'D2: 204', direcao: null, observacoes: null },
      { tipo: 'PORTA', edificio: 'D2', piso: 2, sala_codigo: 'D2-205', texto_principal: null, linhas_texto: JSON.stringify(['D2-205', 'SALA DE AULA']), etiqueta_preta: 'D2: 205 / Laboratorio', direcao: null, observacoes: 'Sala de Aula na placa vs Laboratorio na etiqueta e no quadro de informação' },
      { tipo: 'ENTRADA', edificio: 'D2', piso: null, sala_codigo: null, texto_principal: null, linhas_texto: JSON.stringify(['Universidade de Ciências e Tecnologias', 'Joaquim Alberto Chissano', 'UJAC']), etiqueta_preta: null, direcao: null, observacoes: null },
      { tipo: 'QUADRO_INFORMACAO', edificio: 'D2', piso: 1, sala_codigo: null, texto_principal: 'D2 . INFORMAÇÃO', linhas_texto: JSON.stringify(['1 Piso: 101, 102, 103, 104, 105 Laboratorio, 106, 107, 108, 109, 110, 111, 112']), etiqueta_preta: null, direcao: null, observacoes: 'Só 105 e 205 têm designação no quadro' },
      { tipo: 'QUADRO_INFORMACAO', edificio: 'D2', piso: 2, sala_codigo: null, texto_principal: 'D2 . INFORMAÇÃO', linhas_texto: JSON.stringify(['2 Piso: 201, 202, 203, 204, 205 Laboratorio, 206, 207, 207A, 208, 209, 210, 211, 212, 213']), etiqueta_preta: null, direcao: null, observacoes: 'Só 105 e 205 têm designação no quadro' },
      { tipo: 'DIRECIONAL', edificio: 'D2', piso: 1, sala_codigo: null, texto_principal: null, linhas_texto: JSON.stringify(['SALAS DE AULA: D2-101', 'SALA D2-103: PROFESSORES', 'GABINETE DE APOIO AO ESTUDANTE', 'WC']), etiqueta_preta: null, direcao: 'direita', observacoes: null },
      { tipo: 'DIRECIONAL', edificio: 'D2', piso: 2, sala_codigo: null, texto_principal: null, linhas_texto: JSON.stringify(['SALAS:', 'D2-201', 'D2-203', 'D2-205', 'D2-202', 'D2-204', 'D2-206', 'GABINETE DE AVALIAÇÃO E QUALIDADE', 'WC']), etiqueta_preta: null, direcao: 'direita', observacoes: 'as salas estão em duas colunas: 201/203/205 à esquerda e 202/204/206 à direita' },
    ];

    for (const p of placas) {
      const existing = await prisma.$queryRaw`
        SELECT id FROM "placas" WHERE "tipo" = ${p.tipo}::"PlacaTipo" AND "edificio" = ${p.edificio} AND "piso" IS NOT DISTINCT FROM ${p.piso ?? null} AND "sala_codigo" IS NOT DISTINCT FROM ${p.sala_codigo ?? null} LIMIT 1
      `;
      if (Array.isArray(existing) && existing.length > 0) {
        await prisma.$queryRaw`
          UPDATE "placas"
          SET "texto_principal" = ${p.texto_principal},
              "linhas_texto" = ${p.linhas_texto}::jsonb,
              "etiqueta_preta" = ${p.etiqueta_preta},
              "direcao" = ${p.direcao},
              "observacoes" = ${p.observacoes},
              "updatedAt" = NOW()
          WHERE "tipo" = ${p.tipo}::"PlacaTipo" AND "edificio" = ${p.edificio} AND "piso" IS NOT DISTINCT FROM ${p.piso ?? null} AND "sala_codigo" IS NOT DISTINCT FROM ${p.sala_codigo ?? null}
        `;
        console.log(`  Atualizada: ${p.tipo} ${p.edificio} ${p.piso ?? ''} ${p.sala_codigo ?? ''}`);
      } else {
        await prisma.$queryRaw`
          INSERT INTO "placas" ("id", "tipo", "edificio", "piso", "sala_codigo", "texto_principal", "linhas_texto", "etiqueta_preta", "direcao", "observacoes", "createdAt", "updatedAt")
          VALUES (${cuid()}, ${p.tipo}::"PlacaTipo", ${p.edificio}, ${p.piso}, ${p.sala_codigo}, ${p.texto_principal}, ${p.linhas_texto}::jsonb, ${p.etiqueta_preta}, ${p.direcao}, ${p.observacoes}, NOW(), NOW())
        `;
        console.log(`  Criada: ${p.tipo} ${p.edificio} ${p.piso ?? ''} ${p.sala_codigo ?? ''}`);
      }
    }

    // === 3. Marcar tem_placa = true nas salas com placa de porta ===
    console.log('\n3. A marcar tem_placa = true nas salas com placa:');
    const roomsWithPlaca = ['D2-101', 'D2-103', 'D2-104', 'D2-201', 'D2-202', 'D2-203', 'D2-204', 'D2-205'];
    const result = await prisma.$queryRaw`
      UPDATE "Room"
      SET "tem_placa" = true, "updatedAt" = NOW()
      WHERE "code" = ANY(${roomsWithPlaca}) AND "tem_placa" IS DISTINCT FROM true
    `;
    console.log(`  Salas atualizadas: ${(result as any[]).length}`);
  });

  console.log('\nPlacas e estados atualizados com sucesso.');

  // === Validação ===
  console.log('\n--- Contagem de placas por tipo (D2) ---');
  const countByTipo = await prisma.$queryRaw`
    SELECT "tipo", COUNT(*) as total FROM "placas" WHERE "edificio" = 'D2' GROUP BY "tipo" ORDER BY "tipo"
  `;
  console.table(countByTipo);

  console.log('\n--- Total de placas (D2) ---');
  const total = await prisma.$queryRaw`SELECT COUNT(*) as total FROM "placas" WHERE "edificio" = 'D2'`;
  console.table(total);

  console.log('\n--- Salas D2 com tem_placa = true ---');
  const salasComPlaca = await prisma.$queryRaw`
    SELECT "code", "floor", "tem_placa" FROM "Room" WHERE "code" LIKE 'D2-%' AND "tem_placa" = true ORDER BY "floor", "code"
  `;
  console.table(salasComPlaca);

  console.log('\n--- Salas D2 com tem_placa = false ---');
  const salasSemPlaca = await prisma.$queryRaw`
    SELECT "code", "floor", "tem_placa" FROM "Room" WHERE "code" LIKE 'D2-%' AND "tem_placa" = false ORDER BY "floor", "code"
  `;
  console.table(salasSemPlaca);

  console.log('\n--- Lista detalhada de placas (D2) ---');
  const todasPlacas = await prisma.$queryRaw`
    SELECT "tipo", "piso", "sala_codigo", "texto_principal", "linhas_texto", "etiqueta_preta", "direcao", "observacoes"
    FROM "placas" WHERE "edificio" = 'D2'
    ORDER BY "tipo", "piso", "sala_codigo"
  `;
  console.table(todasPlacas);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
