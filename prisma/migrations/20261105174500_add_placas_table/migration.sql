-- CreateEnum
CREATE TYPE "PlacaTipo" AS ENUM ('PORTA', 'ENTRADA', 'QUADRO_INFORMACAO', 'DIRECIONAL');

-- CreateTable
CREATE TABLE "placas" (
    "id" TEXT NOT NULL,
    "tipo" "PlacaTipo" NOT NULL,
    "edificio" TEXT NOT NULL,
    "piso" INTEGER,
    "sala_codigo" TEXT,
    "texto_principal" TEXT,
    "linhas_texto" JSONB NOT NULL DEFAULT '[]',
    "etiqueta_preta" TEXT,
    "direcao" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "placas" ADD CONSTRAINT "placas_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "Room"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "placas_edificio_idx" ON "placas"("edificio");

-- CreateIndex
CREATE INDEX "placas_sala_codigo_idx" ON "placas"("sala_codigo");

-- CreateIndex
CREATE INDEX "placas_tipo_idx" ON "placas"("tipo");
