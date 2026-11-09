-- CreateEnum
CREATE TYPE "POITipo" AS ENUM ('ENTRADA', 'SAIDA', 'WC', 'REFEITORIO', 'BIBLIOTECA', 'SECRETARIA', 'AUDITORIO', 'LABORATORIO', 'SALA_AULA', 'ESCADA', 'ELEVADOR', 'OUTRO');

-- CreateTable
CREATE TABLE "poi" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "POITipo" NOT NULL DEFAULT 'OUTRO',
    "edificioId" TEXT,
    "sala_codigo" TEXT,
    "piso" INTEGER,
    "mapX" INTEGER NOT NULL DEFAULT 0,
    "mapY" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "poi" ADD CONSTRAINT "poi_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi" ADD CONSTRAINT "poi_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "Room"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "poi_edificioId_idx" ON "poi"("edificioId");

-- CreateIndex
CREATE INDEX "poi_sala_codigo_idx" ON "poi"("sala_codigo");

-- CreateIndex
CREATE INDEX "poi_tipo_idx" ON "poi"("tipo");

-- CreateIndex
CREATE INDEX "poi_piso_idx" ON "poi"("piso");
