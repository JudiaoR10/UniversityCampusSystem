-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "everNegative" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: marca negativas já registadas (imutável a partir de agora)
UPDATE "Grade" SET "everNegative" = true WHERE "valuePercent" < 50;
