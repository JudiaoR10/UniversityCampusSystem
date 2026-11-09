// http/financialRouter.ts
// Camada HTTP: rotas Express do modulo financeiro
// Cada rota: 1) autentica, 2) autoriza, 3) valida com Zod, 4) chama o service

import { Router, Request, Response, NextFunction } from "express";
import {
  financialNotificationIdSchema,
  financialPageSchema,
  financialDebtQuerySchema,
  financialNotificationQueueQuerySchema,
  retryFinancialNotificationSchema,
  createDebtSchema,
  createDebtsFromEnrolmentsSchema,
  createPaymentSchema,
  createAnalysisRequestSchema,
  resolveAnalysisRequestSchema,
  updateFinancialPolicySchema,
  financialStudentQuerySchema,
  financialAnalysisQuerySchema,
  financialAnalysisIdSchema,
  monthlyReportQuerySchema,
  salaryQuerySchema,
  createSalarySchema,
  salaryPaymentSchema,
  employeeQuerySchema,
  createExternalEmployeeSchema,
  createSalaryChangeSchema,
  salaryChangeQuerySchema,
  reviewSalaryChangeSchema,
  updateCourseTuitionSchema,
} from "@smart-campus/validation";
import { authenticate, authorize } from "../../../middleware/auth.js";
import { success } from "../../../middleware/errorHandler.js";
import { AppError } from "../../../lib/errors.js";
const sendSuccess = <T>(res: Response, data: T, status = 200, total?: number) =>
  success(res, data, status, total === undefined ? {} : { total });
const sendError = (
  _res: Response,
  status: number,
  code: string,
  message: string,
): never => {
  throw new AppError(code, message, status);
};
import * as financialService from "../application/financialService.js";
import { searchStudents } from '../../users/application/studentDirectoryService.js';
import { searchTeachers } from '../../users/application/teacherDirectoryService.js';
import * as payroll from '../application/payrollService.js';
import { monthlyPaymentReport } from '../application/monthlyReportService.js';

import {
  getNotificationDelivery,
  retryNotification,
} from "../application/notificationDeliveryService.js";

const router = Router();

router.get('/teachers', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await searchTeachers(req.user!, financialStudentQuerySchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});
router.get('/employees', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await payroll.listEmployees(req.user!, employeeQuerySchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});
router.post('/employees/external', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    success(res, await payroll.createExternalEmployee(
      req.user!, createExternalEmployeeSchema.parse(req.body), req.correlationId,
    ), 201);
  } catch (error) { next(error); }
});
router.get('/salary-change-requests', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await payroll.listSalaryChangeRequests(req.user!, salaryChangeQuerySchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});
router.post('/salary-change-requests', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    success(res, await payroll.createSalaryChangeRequest(
      req.user!, createSalaryChangeSchema.parse(req.body), req.correlationId,
    ), 201);
  } catch (error) { next(error); }
});
router.patch('/salary-change-requests/:id/review', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = financialAnalysisIdSchema.parse(req.params);
    success(res, await payroll.reviewSalaryChangeRequest(
      req.user!, id, reviewSalaryChangeSchema.parse(req.body), req.correlationId,
    ));
  } catch (error) { next(error); }
});
router.get('/salaries', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await payroll.listSalaries(req.user!, salaryQuerySchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});
router.post('/salaries', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try { success(res, await payroll.createSalary(req.user!, createSalarySchema.parse(req.body), req.correlationId), 201); }
  catch (error) { next(error); }
});
router.post('/salaries/:id/payment', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    const { id } = financialAnalysisIdSchema.parse(req.params);
    success(res, await payroll.paySalary(req.user!, id, salaryPaymentSchema.parse(req.body), req.correlationId));
  } catch (error) { next(error); }
});
router.get('/course-tuitions', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try { success(res, await payroll.listCourseTuitions(req.user!)); }
  catch (error) { next(error); }
});
router.put('/course-tuitions/:id', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    const { id } = financialAnalysisIdSchema.parse(req.params);
    success(res, await payroll.updateCourseTuition(
      req.user!, id, updateCourseTuitionSchema.parse(req.body), req.correlationId,
    ));
  } catch (error) { next(error); }
});
router.get('/salaries/:id/receipt', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = financialAnalysisIdSchema.parse(req.params);
    success(res, await payroll.getSalaryReceipt(req.user!, id));
  } catch (error) { next(error); }
});
router.get('/reports/payments', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const { month } = monthlyReportQuerySchema.parse(req.query);
    success(res, await monthlyPaymentReport(req.user!, 'payments', month));
  } catch (error) { next(error); }
});
router.get('/reports/salaries', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const { month } = monthlyReportQuerySchema.parse(req.query);
    success(res, await monthlyPaymentReport(req.user!, 'salaries', month));
  } catch (error) { next(error); }
});

router.get('/students', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await searchStudents(req.user!, financialStudentQuerySchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});

router.get('/analysis-requests', authenticate, authorize('STUDENT', 'FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await financialService.listAnalysisRequests(req.user!, financialAnalysisQuerySchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});

router.get('/analysis-requests/:id', authenticate, authorize('STUDENT', 'FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = financialAnalysisIdSchema.parse(req.params);
    success(res, await financialService.getAnalysisRequest(req.user!, id));
  } catch (error) { next(error); }
});

router.get('/notifications', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await financialService.listNotificationQueue(financialNotificationQueueQuerySchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});
router.post('/notifications/retry-failed', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    retryFinancialNotificationSchema.parse(req.body ?? {});
    sendSuccess(res, await financialService.retryFailedNotifications(req.user!.id, req.correlationId));
  } catch (error) { next(error); }
});
router.get(
  "/notifications/:notificationId/delivery",
  authenticate,
  authorize("FINANCE", "ADMIN"),
  async (req, res, next) => {
    try {
      const { notificationId } = financialNotificationIdSchema.parse(
        req.params,
      );
      sendSuccess(res, await getNotificationDelivery(notificationId));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/notifications/:notificationId/retry",
  authenticate,
  authorize("FINANCE"),
  async (req, res, next) => {
    try {
      const { notificationId } = financialNotificationIdSchema.parse(
        req.params,
      );
      retryFinancialNotificationSchema.parse(req.body ?? {});
      const result = await retryNotification(
        notificationId,
        req.user!.id,
        req.correlationId!,
      );
      sendSuccess(
        res,
        result,
        result.deliveryStatus === "SENT" ||
          result.deliveryStatus === "LOCAL_ONLY"
          ? 200
          : 202,
      );
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// DEBTS — Dividas
// Exercicio 3: create + list/get com validacao Zod
// =============================================================================

/**
 * GET /api/v1/financial/debts
 * Lista uma pagina de dividas. FINANCE e ADMIN veem tudo; STUDENT ve apenas as suas.
 */
router.get(
  "/debts",
  authenticate,
  authorize("STUDENT", "FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = financialDebtQuerySchema.parse(req.query);

      if (
        req.user!.role === "STUDENT" &&
        query.studentId &&
        query.studentId !== req.user!.id
      ) {
        sendError(
          res,
          403,
          "FORBIDDEN",
          "Nao pode listar dividas de outro estudante.",
        );
        return;
      }

      const debts = await financialService.listDebts({
        ...query,
        studentId: req.user!.role === "STUDENT" ? req.user!.id : query.studentId,
      });
      sendSuccess(res, debts, 200, debts.length);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/financial/debts/:id
 * Consultar uma divida especifica por ID.
 */
router.get(
  "/debts/:id",
  authenticate,
  authorize("STUDENT", "FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const debt = await financialService.getDebtById(req.params.id);

      if (req.user!.role === "STUDENT" && req.user!.id !== debt.studentId) {
        sendError(
          res,
          403,
          "FORBIDDEN",
          "Nao pode consultar uma divida de outro estudante.",
        );
        return;
      }

      sendSuccess(res, debt, 200);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/financial/debts
 * Registar nova divida. Apenas FINANCE (INV-3).
 * Validacao Zod rejeita campos em falta com erro 400 estruturado (Exercicio 3).
 */
router.post(
  "/debts",
  authenticate,
  authorize("FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Zod valida o body — se falhar, lanca ZodError que o errorHandler converte em 400
      const input = createDebtSchema.parse(req.body);
      const debt = await financialService.createDebt(
        input,
        req.user!.id,
        req.correlationId,
      );
      sendSuccess(res, debt, 201);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/debts/from-enrolments",
  authenticate,
  authorize("FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createDebtsFromEnrolmentsSchema.parse(req.body);
      sendSuccess(
        res,
        await financialService.createDebtsFromEnrolments(
          input,
          req.user!.id,
          req.correlationId,
        ),
        201,
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/debts/:id/cancel",
  authenticate,
  authorize("FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await financialService.cancelDebt(req.params.id, req.user!.id, req.correlationId),
      );
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// PAYMENTS — Pagamentos
// Exercicio 5: Transaccao ACID dentro do service
// =============================================================================

/**
 * POST /api/v1/financial/payments
 * Confirmar pagamento e regularizar divida (transaccao atomica). Apenas FINANCE.
 */
router.post(
  "/payments",
  authenticate,
  authorize("FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createPaymentSchema.parse(req.body);
      const resultado = await financialService.createPayment(
        input,
        req.user!.id,
        req.correlationId,
      );
      sendSuccess(res, resultado, 201);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/payments/:id/receipt",
  authenticate,
  authorize("STUDENT", "FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = financialAnalysisIdSchema.parse(req.params);
      sendSuccess(res, await financialService.getPaymentReceipt(id, req.user!));
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// FINANCIAL STATUS — Estado Financeiro do Estudante
// =============================================================================

/**
 * GET /api/v1/financial/students/:studentId/status
 * Consultar estado financeiro de um estudante (ponto de integracao inter-modulos).
 * STUDENT so ve o proprio; FINANCE e ADMIN podem consultar outros estudantes.
 */
router.get('/students/blocked', authenticate, authorize('FINANCE', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await financialService.listBlockedStudents(financialPageSchema.parse(req.query));
    success(res, result.data, 200, result.meta);
  } catch (error) { next(error); }
});

router.get(
  "/students/:studentId/status",
  authenticate,
  authorize("STUDENT", "FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // INV-5: STUDENT so pode ver o seu proprio estado
      if (req.user!.role === "STUDENT" && req.user!.id !== studentId) {
        sendError(
          res,
          403,
          "FORBIDDEN",
          "Nao pode consultar o estado financeiro de outro estudante.",
        );
        return;
      }

      const status = await financialService.getStudentStatus(studentId);
      sendSuccess(res, status, 200);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/financial/students/:studentId/history
 * Historico paginado de dividas e pagamentos, com totais globais.
 */
router.get(
  "/students/:studentId/history",
  authenticate,
  authorize("STUDENT", "FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      if (req.user!.role === "STUDENT" && req.user!.id !== studentId) {
        sendError(
          res,
          403,
          "FORBIDDEN",
          "Nao pode consultar o historico financeiro de outro estudante.",
        );
        return;
      }

      const history = await financialService.getStudentHistory(
        studentId,
        financialPageSchema.parse(req.query),
      );
      sendSuccess(res, history, 200);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/financial/students/:studentId/notifications
 * Notificacoes financeiras do estudante.
 */
router.get(
  "/students/:studentId/notifications",
  authenticate,
  authorize("STUDENT", "FINANCE", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      if (req.user!.role === "STUDENT" && req.user!.id !== studentId) {
        sendError(
          res,
          403,
          "FORBIDDEN",
          "Nao pode consultar as notificacoes de outro estudante.",
        );
        return;
      }

      const notifications = await financialService.getStudentNotifications(
        studentId,
        financialPageSchema.parse({ limit: "30", ...req.query }),
      );
      sendSuccess(res, notifications, 200, notifications.length);
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// ANALYSIS REQUESTS — Pedidos de Analise / Contestacoes
// Exercicio 4: PATCH com regra de negocio (nao pode resolver o que ja foi decidido)
// =============================================================================

/**
 * POST /api/v1/financial/analysis-requests
 * Submeter contestacao de divida. Apenas STUDENT (INV-5).
 */
router.post(
  "/analysis-requests",
  authenticate,
  authorize("STUDENT"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createAnalysisRequestSchema.parse(req.body);
      const ar = await financialService.createAnalysisRequest(
        input,
        req.user!.id,
        req.correlationId,
      );
      sendSuccess(res, ar, 201);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/v1/financial/analysis-requests/:id
 * Resolver contestacao: PROCEDENTE ou IMPROCEDENTE. Apenas FINANCE (INV-3).
 * Exercicio 4: regra de negocio — nao pode resolver uma contestacao ja decidida.
 */
router.patch(
  "/analysis-requests/:id",
  authenticate,
  authorize("FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = resolveAnalysisRequestSchema.parse(req.body);
      const ar = await financialService.resolveAnalysisRequest(
        req.params.id,
        input,
        req.user!.id,
        req.correlationId,
      );
      sendSuccess(res, ar, 200);
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// REPORTS — Relatorio Financeiro
// =============================================================================

/**
 * GET /api/v1/financial/reports
 * Relatorio agregado de dividas e pendencias. Apenas FINANCE e ADMIN.
 */
router.get(
  "/reports",
  authenticate,
  authorize("FINANCE", "ADMIN"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await financialService.getReport();
      sendSuccess(res, report, 200);
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// POLICIES — Politica Financeira
// Exercicio 4: GET e PATCH com regra de acesso (apenas ADMIN)
// =============================================================================

/**
 * GET /api/v1/financial/policies/:policyId
 * Consultar politica financeira activa.
 */
router.get(
  "/policies/:policyId",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const policy = await financialService.getPolicy(req.params.policyId);
      sendSuccess(res, policy, 200);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/v1/financial/policies/:policyId
 * Actualizar politica de bloqueio e tolerancia. Apenas ADMIN.
 */
router.patch(
  "/policies/:policyId",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = updateFinancialPolicySchema.parse(req.body);
      const policy = await financialService.updatePolicy(
        req.params.policyId,
        input,
        req.user!.id,
        req.correlationId,
      );
      sendSuccess(res, policy, 200);
    } catch (error) {
      next(error);
    }
  },
);

// Converter conflitos do módulo para o contrato de erros do Core.
router.use(
  (error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    const code = (error as { code?: string })?.code;
    next(
      code === "P2002" || code === "P2034"
        ? new AppError(
            "RESOURCE_CONFLICT",
            "Operação financeira em conflito.",
            409,
          )
        : error,
    );
  },
);
export default router;
