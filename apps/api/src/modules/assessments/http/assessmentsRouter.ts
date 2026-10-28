import { Router } from 'express';
import { z } from 'zod';
import {
  createAssessmentSchema,
  createResultSchema,
  publishResultsSchema,
  setRequiredTestCountSchema,
  setSubjectRulesSchema,
  updateAssessmentSchema,
  upsertGradesSchema,
} from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as assessmentService from '../application/assessmentService.js';
import * as resultService from '../application/resultService.js';

export const assessmentsRouter = Router();

const STAFF = ['TEACHER', 'COORDINATOR', 'ADMIN'];
const STUDENT_DATA_ROLES = ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'];

// Contrato G3: STUDENT consulta avaliações disponíveis (do seu curso), gestão é dos staffs
assessmentsRouter.get('/assessments', authenticate, authorize(...STUDENT_DATA_ROLES), async (req, res, next) => {
  try {
    success(res, await assessmentService.listAssessments(req.user!));
  } catch (err) {
    next(err);
  }
});

// Criação de avaliações: exclusiva do docente (TEACHER) da disciplina — a
// ligação docente↔disciplina é validada em assertTeacherTeachesSubject().
assessmentsRouter.post('/assessments', authenticate, authorize('TEACHER'), async (req, res, next) => {
  try {
    const body = createAssessmentSchema.parse(req.body);
    const assessment = await assessmentService.createAssessment(body, req.user!, req.correlationId);
    success(res, assessment, 201);
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.get('/assessments/options', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    success(res, await assessmentService.listAssessmentOptions(req.user!));
  } catch (err) {
    next(err);
  }
});

// O docente da disciplina define o número de testes necessário para a situação final.
assessmentsRouter.patch(
  '/assessments/subject/:subjectId/required-test-count',
  authenticate,
  authorize('TEACHER'),
  async (req, res, next) => {
    try {
      const body = setRequiredTestCountSchema.parse(req.body);
      success(
        res,
        await assessmentService.setSubjectRequiredTestCount(
          req.params.subjectId,
          body.requiredTestCount,
          req.user!,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

// Board completo da disciplina: contagens + linhas para os 4 separadores
// (Frequência e Dispensa, Exame Normal, Recorrência, Resultados Finais).
assessmentsRouter.get(
  '/assessments/subject/:subjectId/board',
  authenticate,
  authorize(...STAFF),
  async (req, res, next) => {
    try {
      success(res, await assessmentService.getSubjectBoard(req.params.subjectId, req.user!));
    } catch (err) {
      next(err);
    }
  },
);

// Regras configuráveis da disciplina (nº de testes exigidos + mínimo de
// admissão para recorrência) — docente titular, coordenador ou admin.
assessmentsRouter.patch(
  '/assessments/subject/:subjectId/rules',
  authenticate,
  authorize(...STAFF),
  async (req, res, next) => {
    try {
      const body = setSubjectRulesSchema.parse(req.body);
      success(res, await assessmentService.setSubjectRules(req.params.subjectId, body, req.user!, req.correlationId));
    } catch (err) {
      next(err);
    }
  },
);

// Publica ou reabre a pauta da disciplina (alterações de notas bloqueadas enquanto publicada).
assessmentsRouter.post(
  '/assessments/subject/:subjectId/publish',
  authenticate,
  authorize(...STAFF),
  async (req, res, next) => {
    try {
      const body = publishResultsSchema.parse(req.body);
      success(
        res,
        await assessmentService.setSubjectPublication(
          req.params.subjectId,
          body.published,
          req.user!,
          req.correlationId,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

// Dispensa imposta pelo docente/coordenação: condição de dispensa definida
// livremente pelo docente (auditoria sempre registada no serviço).
assessmentsRouter.post(
  '/assessments/subject/:subjectId/exemptions',
  authenticate,
  authorize(...STAFF),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          studentId: z.string().min(1, 'studentId é obrigatório'),
          exempted: z.boolean({ invalid_type_error: 'exempted deve ser boolean' }),
          /** Nota de dispensa (0–20) escolhida pelo docente. */
          grade: z.number().min(0).max(20).nullish(),
          reason: z.string().max(500).nullish(),
        })
        .parse(req.body);
      success(
        res,
        await assessmentService.setSubjectExemption(req.params.subjectId, body, req.user!, req.correlationId),
      );
    } catch (err) {
      next(err);
    }
  },
);

assessmentsRouter.get('/assessments/:id/roster', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    success(res, await assessmentService.getAssessmentRoster(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.get('/assessments/:id', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    success(res, await assessmentService.getAssessment(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.patch('/assessments/:id', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    const body = updateAssessmentSchema.parse(req.body);
    success(res, await assessmentService.updateAssessment(req.params.id, body, req.user!, req.correlationId));
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.get('/assessments/:id/grades', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    success(res, await assessmentService.listAssessmentGrades(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

// Lançamento de notas em bloco: exclusivo do docente (TEACHER) da disciplina.
assessmentsRouter.post('/assessments/:id/grades', authenticate, authorize('TEACHER'), async (req, res, next) => {
  try {
    const body = upsertGradesSchema.parse(req.body);
    success(res, await assessmentService.upsertGrades(req.params.id, body, req.user!, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.get('/my/grades', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    success(res, await assessmentService.listMyGrades(req.user!.id));
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.get('/my/final-grades', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    success(res, await assessmentService.listMyFinalGrades(req.user!.id));
  } catch (err) {
    next(err);
  }
});

// Contrato G3 — GET /api/v1/results
assessmentsRouter.get('/results', authenticate, authorize(...STUDENT_DATA_ROLES), async (req, res, next) => {
  try {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    success(res, await resultService.listResults(req.user!, studentId));
  } catch (err) {
    next(err);
  }
});

// Contrato G3 — POST /api/v1/results (TEACHER gere resultados das suas disciplinas)
assessmentsRouter.post('/results', authenticate, authorize('TEACHER'), async (req, res, next) => {
  try {
    const body = createResultSchema.parse(req.body);
    success(res, await resultService.createResult(body, req.user!, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.get('/students/:id/grades', authenticate, authorize(...STUDENT_DATA_ROLES), async (req, res, next) => {
  try {
    success(res, await assessmentService.listStudentGrades(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

assessmentsRouter.get(
  '/students/:id/final-grades',
  authenticate,
  authorize(...STUDENT_DATA_ROLES),
  async (req, res, next) => {
    try {
      success(res, await assessmentService.getFinalGrades(req.params.id, req.user!));
    } catch (err) {
      next(err);
    }
  },
);
