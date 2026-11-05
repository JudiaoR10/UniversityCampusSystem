-- Enrolment.status: TEXT -> EnrolmentStatus when needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Enrolment'
      AND column_name = 'status'
      AND udt_name IN ('text', 'varchar')
  ) THEN
    ALTER TABLE "Enrolment"
      ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Enrolment"
      ALTER COLUMN "status" TYPE "EnrolmentStatus"
      USING "status"::"EnrolmentStatus";
    ALTER TABLE "Enrolment"
      ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"EnrolmentStatus";
  END IF;
END $$;

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "ingestToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Device_ingestToken_key" ON "Device"("ingestToken");
