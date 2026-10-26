-- CreateEnum
CREATE TYPE "StudentProfileStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'GRADUATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TeacherProfileStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'COMPLETED');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "StudentProfileStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "TeacherProfileStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "SubjectEnrolment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectEnrolment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectEnrolment_subjectId_idx" ON "SubjectEnrolment"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectEnrolment_studentId_subjectId_academicYear_key" ON "SubjectEnrolment"("studentId", "subjectId", "academicYear");

-- AddForeignKey
ALTER TABLE "SubjectEnrolment" ADD CONSTRAINT "SubjectEnrolment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectEnrolment" ADD CONSTRAINT "SubjectEnrolment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
