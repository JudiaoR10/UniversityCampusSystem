CREATE TYPE "EmployeeCategory" AS ENUM ('TEACHER', 'TECHNICIAN', 'COORDINATOR', 'ADMINISTRATIVE', 'FINANCE', 'CLEANER', 'GUARD', 'OTHER');
CREATE TYPE "SalaryChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "external_employees" (
  "id" TEXT NOT NULL,
  "employeeCode" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "category" "EmployeeCategory" NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_compensations" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "externalEmployeeId" TEXT,
  "currentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_compensations_one_source_check" CHECK (("userId" IS NOT NULL) <> ("externalEmployeeId" IS NOT NULL))
);

CREATE TABLE "employee_salaries" (
  "id" TEXT NOT NULL,
  "compensationId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" "SalaryStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "PaymentMethod",
  "referenceCode" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "salary_change_requests" (
  "id" TEXT NOT NULL,
  "compensationId" TEXT NOT NULL,
  "proposedAmount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "SalaryChangeStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "salary_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_tuitions" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_tuitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_employees_employeeCode_key" ON "external_employees"("employeeCode");
CREATE INDEX "external_employees_category_isActive_idx" ON "external_employees"("category", "isActive");
CREATE UNIQUE INDEX "employee_compensations_userId_key" ON "employee_compensations"("userId");
CREATE UNIQUE INDEX "employee_compensations_externalEmployeeId_key" ON "employee_compensations"("externalEmployeeId");
CREATE UNIQUE INDEX "employee_salaries_compensationId_month_key" ON "employee_salaries"("compensationId", "month");
CREATE UNIQUE INDEX "employee_salaries_paymentMethod_referenceCode_key" ON "employee_salaries"("paymentMethod", "referenceCode");
CREATE INDEX "employee_salaries_month_status_idx" ON "employee_salaries"("month", "status");
CREATE INDEX "employee_salaries_paidAt_idx" ON "employee_salaries"("paidAt");
CREATE INDEX "salary_change_requests_status_createdAt_idx" ON "salary_change_requests"("status", "createdAt");
CREATE INDEX "salary_change_requests_compensationId_status_idx" ON "salary_change_requests"("compensationId", "status");
CREATE UNIQUE INDEX "course_tuitions_courseId_key" ON "course_tuitions"("courseId");

ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_externalEmployeeId_fkey" FOREIGN KEY ("externalEmployeeId") REFERENCES "external_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_compensationId_fkey" FOREIGN KEY ("compensationId") REFERENCES "employee_compensations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_change_requests" ADD CONSTRAINT "salary_change_requests_compensationId_fkey" FOREIGN KEY ("compensationId") REFERENCES "employee_compensations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_change_requests" ADD CONSTRAINT "salary_change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_change_requests" ADD CONSTRAINT "salary_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_tuitions" ADD CONSTRAINT "course_tuitions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "employee_compensations" ("id", "userId", "currentAmount", "approvedAt", "createdAt", "updatedAt")
SELECT 'comp_' || tp."id", tp."userId", COALESCE(latest."amount", 0), CASE WHEN latest."amount" IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "TeacherProfile" tp
LEFT JOIN LATERAL (
  SELECT ts."amount" FROM "teacher_salaries" ts WHERE ts."teacherId" = tp."id" ORDER BY ts."month" DESC, ts."createdAt" DESC LIMIT 1
) latest ON true;

INSERT INTO "employee_salaries" ("id", "compensationId", "month", "amount", "notes", "status", "paymentMethod", "referenceCode", "paidAt", "createdAt", "updatedAt")
SELECT ts."id", ec."id", ts."month", ts."amount", ts."notes", ts."status", ts."paymentMethod", ts."referenceCode", ts."paidAt", ts."createdAt", ts."updatedAt"
FROM "teacher_salaries" ts
JOIN "TeacherProfile" tp ON tp."id" = ts."teacherId"
JOIN "employee_compensations" ec ON ec."userId" = tp."userId";

DROP TABLE "teacher_salaries";
