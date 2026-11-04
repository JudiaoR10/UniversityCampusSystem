-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('TEST', 'EXAM', 'ASSIGNMENT', 'PRACTICAL', 'ORAL', 'OTHER', 'RECURRENCE');

-- CreateEnum
CREATE TYPE "GradingMode" AS ENUM ('PERCENTAGE', 'POINTS', 'SCALE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('SEMESTER', 'TRIMESTER', 'QUARTER', 'ANNUAL');

-- CreateEnum
CREATE TYPE "GradingScope" AS ENUM ('GLOBAL', 'COURSE', 'SUBJECT', 'PERIOD');

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "recurrenceMinAdmission" DOUBLE PRECISION,
ADD COLUMN     "requiredTestCount" INTEGER,
ADD COLUMN     "resultsPublishedAt" TIMESTAMP(3),
ADD COLUMN     "resultsPublishedById" TEXT;

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PeriodType" NOT NULL DEFAULT 'SEMESTER',
    "academicYearId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingConfig" (
    "id" TEXT NOT NULL,
    "scope" "GradingScope" NOT NULL DEFAULT 'COURSE',
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "appliesFrom" TIMESTAMP(3),
    "appliesTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodResult" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "averagePercent" DOUBLE PRECISION,
    "averageGrade" INTEGER,
    "creditsAttempted" INTEGER NOT NULL DEFAULT 0,
    "creditsObtained" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL DEFAULT 'TEST',
    "gradingMode" "GradingMode" NOT NULL DEFAULT 'PERCENTAGE',
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "weight" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3),
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "valuePercent" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "gradedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT,
    "roomId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "classScheduleId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectExemption" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exemptedById" TEXT NOT NULL,
    "reason" TEXT,
    "grade" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectExemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_code_key" ON "AcademicYear"("code");

-- CreateIndex
CREATE INDEX "Period_academicYearId_idx" ON "Period"("academicYearId");

-- CreateIndex
CREATE INDEX "Period_closed_idx" ON "Period"("closed");

-- CreateIndex
CREATE UNIQUE INDEX "Period_academicYearId_code_key" ON "Period"("academicYearId", "code");

-- CreateIndex
CREATE INDEX "GradingConfig_scope_scopeId_idx" ON "GradingConfig"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "GradingConfig_active_idx" ON "GradingConfig"("active");

-- CreateIndex
CREATE INDEX "PeriodResult_studentId_idx" ON "PeriodResult"("studentId");

-- CreateIndex
CREATE INDEX "PeriodResult_periodId_idx" ON "PeriodResult"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodResult_periodId_studentId_key" ON "PeriodResult"("periodId", "studentId");

-- CreateIndex
CREATE INDEX "Assessment_subjectId_idx" ON "Assessment"("subjectId");

-- CreateIndex
CREATE INDEX "Assessment_createdById_idx" ON "Assessment"("createdById");

-- CreateIndex
CREATE INDEX "Grade_studentId_idx" ON "Grade"("studentId");

-- CreateIndex
CREATE INDEX "Grade_assessmentId_idx" ON "Grade"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_assessmentId_studentId_key" ON "Grade"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "ClassSchedule_courseId_idx" ON "ClassSchedule"("courseId");

-- CreateIndex
CREATE INDEX "ClassSchedule_subjectId_idx" ON "ClassSchedule"("subjectId");

-- CreateIndex
CREATE INDEX "ClassSchedule_teacherId_idx" ON "ClassSchedule"("teacherId");

-- CreateIndex
CREATE INDEX "Attendance_studentProfileId_idx" ON "Attendance"("studentProfileId");

-- CreateIndex
CREATE INDEX "Attendance_classScheduleId_idx" ON "Attendance"("classScheduleId");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_classScheduleId_studentProfileId_key" ON "Attendance"("classScheduleId", "studentProfileId");

-- CreateIndex
CREATE INDEX "SubjectExemption_subjectId_idx" ON "SubjectExemption"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectExemption_studentId_idx" ON "SubjectExemption"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectExemption_subjectId_studentId_key" ON "SubjectExemption"("subjectId", "studentId");

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodResult" ADD CONSTRAINT "PeriodResult_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodResult" ADD CONSTRAINT "PeriodResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "ClassSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectExemption" ADD CONSTRAINT "SubjectExemption_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectExemption" ADD CONSTRAINT "SubjectExemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectExemption" ADD CONSTRAINT "SubjectExemption_exemptedById_fkey" FOREIGN KEY ("exemptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
