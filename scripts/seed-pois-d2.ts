import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function cuid(): string {
  return 'c' + Math.random().toString(36).substring(2, 18) + Date.now().toString(36);
}

const POI_SEED = [
  {
    nome: 'WC',
    tipo: 'WC',
    edificio_codigo: 'D2',
    piso: 1,
    mapX: 0,
    mapY: 0,
    descricao: null,
    ativo: true,
  },
  {
    nome: 'WC',
    tipo: 'WC',
    edificio_codigo: 'D2',
    piso: 2,
    mapX: 0,
    mapY: 0,
    descricao: null,
    ativo: true,
  },
  {
    nome: 'Gabinete de Avaliação e Qualidade',
    tipo: 'SECRETARIA',
    edificio_codigo: 'D2',
    piso: 2,
    mapX: 0,
    mapY: 0,
    descricao: null,
    ativo: true,
  },
];

async function main() {
  console.log('A inserir POIs do edifício D2 (UJAC)...');

  const d2Building = await prisma.$queryRaw`
    SELECT id FROM "Building" WHERE "code" = 'D2' LIMIT 1
  `;

  if (Array.isArray(d2Building) && d2Building.length === 0) {
    console.error('Edifício D2 não encontrado na base de dados.');
    process.exit(1);
  }

  const d2Id = (d2Building as any[])[0].id;

  for (const p of POI_SEED) {
    const existing = await prisma.$queryRaw`
      SELECT id FROM "poi" 
      WHERE "nome" = ${p.nome} 
        AND "edificioId" = ${d2Id} 
        AND "piso" = ${p.piso} 
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      await prisma.$queryRaw`
        UPDATE "poi"
        SET "tipo" = ${p.tipo}::"POITipo",
            "descricao" = ${p.descricao},
            "ativo" = ${p.ativo},
            "updatedAt" = NOW()
        WHERE "nome" = ${p.nome} 
          AND "edificioId" = ${d2Id} 
          AND "piso" = ${p.piso}
      `;
      console.log(`  Atualizado: ${p.nome} (piso ${p.piso})`);
    } else {
      await prisma.$queryRaw`
        INSERT INTO "poi" ("id", "nome", "tipo", "edificioId", "piso", "mapX", "mapY", "descricao", "ativo", "createdAt", "updatedAt")
        VALUES (${cuid()}, ${p.nome}, ${p.tipo}::"POITipo", ${d2Id}, ${p.piso}, ${p.mapX}, ${p.mapY}, ${p.descricao}, ${p.ativo}, NOW(), NOW())
      `;
      console.log(`  Criado: ${p.nome} (piso ${p.piso})`);
    }
  }

  console.log('\nPOIs atualizados com sucesso.');

  const total = await prisma.$queryRaw`
    SELECT COUNT(*) as total FROM "poi" WHERE "edificioId" = ${d2Id}
  `;
  console.log(`Total de POIs (D2): ${(total as any[])[0].total}`);

  const todosPois = await prisma.$queryRaw`
    SELECT "nome", "tipo", "piso", "descricao", "ativo" FROM "poi" 
    WHERE "edificioId" = ${d2Id}
    ORDER BY "piso", "nome"
  `;
  console.table(todosPois);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
