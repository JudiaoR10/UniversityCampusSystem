-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- AlterTable Building
ALTER TABLE "Building" ADD COLUMN "mapX" DOUBLE PRECISION;
ALTER TABLE "Building" ADD COLUMN "mapY" DOUBLE PRECISION;

UPDATE "Building" SET "mapX" = 48, "mapY" = 46 WHERE "code" = 'D2';
UPDATE "Building" SET "mapX" = 28, "mapY" = 42 WHERE "code" = 'A';
UPDATE "Building" SET "mapX" = 62, "mapY" = 48 WHERE "code" = 'B';

-- AlterTable Sensor
ALTER TABLE "Sensor" ADD COLUMN "warningMin" DOUBLE PRECISION;
ALTER TABLE "Sensor" ADD COLUMN "warningMax" DOUBLE PRECISION;
ALTER TABLE "Sensor" ADD COLUMN "criticalMin" DOUBLE PRECISION;
ALTER TABLE "Sensor" ADD COLUMN "criticalMax" DOUBLE PRECISION;

UPDATE "Sensor" SET "warningMin" = 18, "warningMax" = 27, "criticalMax" = 32 WHERE "metric" = 'temperature';
UPDATE "Sensor" SET "warningMax" = 800, "criticalMax" = 1000 WHERE "metric" = 'co2';
UPDATE "Sensor" SET "warningMin" = 30, "warningMax" = 65 WHERE "metric" = 'humidity';

-- AlterTable MaintenanceAction
ALTER TABLE "MaintenanceAction" ADD COLUMN "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "MaintenanceAction" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);
