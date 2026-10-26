-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('PENDENTE', 'VENCIDA', 'REGULARIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FinancialStatusType" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AnalysisRequestStatus" AS ENUM ('PENDENTE_ANALISE', 'PROCEDENTE', 'IMPROCEDENTE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH_DEPOSIT', 'MOBILE_MONEY', 'POS');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('LOCAL_ONLY', 'PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "RoleCode" ADD VALUE 'FINANCE';

-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "origin" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_status" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "FinancialStatusType" NOT NULL DEFAULT 'ACTIVE',
    "blockedAt" TIMESTAMP(3),
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_requests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AnalysisRequestStatus" NOT NULL DEFAULT 'PENDENTE_ANALISE',
    "slaDueDate" TIMESTAMP(3) NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_notifications" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL DEFAULT 'FINANCIAL_NOTICE',
    "resourceId" TEXT,
    "correlationId" TEXT,
    "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "externalNotificationId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lockToken" TEXT,

    CONSTRAINT "financial_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_policies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'DEFAULT_POLICY',
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 5,
    "autoBlockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxDebtAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "debts_code_key" ON "debts"("code");

-- CreateIndex
CREATE INDEX "debts_studentId_status_idx" ON "debts"("studentId", "status");

-- CreateIndex
CREATE INDEX "debts_dueDate_idx" ON "debts"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "payments_code_key" ON "payments"("code");

-- CreateIndex
CREATE INDEX "payments_studentId_idx" ON "payments"("studentId");

-- CreateIndex
CREATE INDEX "payments_debtId_idx" ON "payments"("debtId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentMethod_referenceCode_key" ON "payments"("paymentMethod", "referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "payments_debtId_key" ON "payments"("debtId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_status_studentId_key" ON "financial_status"("studentId");

-- CreateIndex
CREATE INDEX "financial_status_studentId_status_idx" ON "financial_status"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_requests_code_key" ON "analysis_requests"("code");

-- CreateIndex
CREATE INDEX "analysis_requests_studentId_status_idx" ON "analysis_requests"("studentId", "status");

-- CreateIndex
CREATE INDEX "analysis_requests_debtId_idx" ON "analysis_requests"("debtId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_notifications_externalNotificationId_key" ON "financial_notifications"("externalNotificationId");

-- CreateIndex
CREATE INDEX "financial_notifications_studentId_read_idx" ON "financial_notifications"("studentId", "read");

-- CreateIndex
CREATE INDEX "financial_notifications_deliveryStatus_nextAttemptAt_idx" ON "financial_notifications"("deliveryStatus", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "financial_policies_code_key" ON "financial_policies"("code");

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_status" ADD CONSTRAINT "financial_status_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_requests" ADD CONSTRAINT "analysis_requests_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_requests" ADD CONSTRAINT "analysis_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_requests" ADD CONSTRAINT "analysis_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_notifications" ADD CONSTRAINT "financial_notifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Uma dívida não pode ter duas contestações pendentes.
CREATE UNIQUE INDEX "analysis_requests_one_pending_per_debt" ON "analysis_requests"("debtId") WHERE status = 'PENDENTE_ANALISE';
