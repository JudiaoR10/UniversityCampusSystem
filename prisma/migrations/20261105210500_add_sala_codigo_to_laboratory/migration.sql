-- AlterTable
ALTER TABLE "Laboratory" ADD COLUMN "sala_codigo" TEXT;

-- AddForeignKey
ALTER TABLE "Laboratory" ADD CONSTRAINT "Laboratory_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "Room"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Laboratory_sala_codigo_idx" ON "Laboratory"("sala_codigo");
