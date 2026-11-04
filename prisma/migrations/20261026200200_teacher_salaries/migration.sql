CREATE TYPE "SalaryStatus" AS ENUM ('PENDING', 'PAID');
CREATE TABLE "teacher_salaries" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "SalaryStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "referenceCode" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "teacher_salaries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teacher_salaries_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "teacher_salaries_payment_complete" CHECK (
      ("status" = 'PENDING' AND "paymentMethod" IS NULL AND "referenceCode" IS NULL AND "paidAt" IS NULL)
      OR ("status" = 'PAID' AND "paymentMethod" IS NOT NULL AND "referenceCode" IS NOT NULL AND "paidAt" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "teacher_salaries_teacherId_month_key" ON "teacher_salaries"("teacherId", "month");
CREATE UNIQUE INDEX "teacher_salaries_paymentMethod_referenceCode_key" ON "teacher_salaries"("paymentMethod", "referenceCode");
CREATE INDEX "teacher_salaries_month_status_idx" ON "teacher_salaries"("month", "status");
CREATE INDEX "teacher_salaries_paidAt_idx" ON "teacher_salaries"("paidAt");
ALTER TABLE "teacher_salaries" ADD CONSTRAINT "teacher_salaries_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
