import { useState } from 'react';
import type { AuthUser, StudentIdentitySummaryDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { ChipTabs } from '../components/ui';
import { StudentPicker } from '../components/financial/StudentPicker';
import { FinancialDebts } from '../components/financial/FinancialDebts';
import { FinancialHistory } from '../components/financial/FinancialHistory';
import { FinancialAnalysis } from '../components/financial/FinancialAnalysis';
import { FinancialPolicy } from '../components/financial/FinancialPolicy';
import { FinancialNotifications } from '../components/financial/FinancialNotifications';
import { FinancialReport } from '../components/financial/FinancialReport';
import { FinancialSalaries } from '../components/financial/FinancialSalaries';
import { FinancialMonthlyReports } from '../components/financial/FinancialMonthlyReports';
import { AdminFinancialOverview } from '../components/financial/AdminFinancialOverview';
import { FinancialCourseTuitions } from '../components/financial/FinancialCourseTuitions';
import { FinancialTuitionIssuance } from '../components/financial/FinancialTuitionIssuance';
import { FinancialStandingBanner } from '../components/financial/FinancialStandingBanner';
import { FinancialGuide } from '../components/financial/guide/FinancialGuide';

export function FinancialPage() {
  const { user } = useAuth();
  if (!user || !['STUDENT', 'FINANCE', 'ADMIN'].includes(user.role)) {
    return <p className="surface p-4 text-sm text-campus-deep sm:p-5">O seu perfil não tem acesso à gestão financeira.</p>;
  }
  return <FinancialWorkspace key={`${user.id}:${user.role}`} user={user} />;
}

function FinancialWorkspace({ user }: { user: AuthUser }) {
  const isAdmin = user.role === 'ADMIN';
  const isFinance = user.role === 'FINANCE';
  const manager = isFinance || isAdmin;
  const [selected, setSelected] = useState<StudentIdentitySummaryDto | null>(null);
  const [tab, setTab] = useState(isAdmin ? 'overview' : 'debts');
  const [studentSection, setStudentSection] = useState('debts');
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const studentId = manager ? selected?.userId : user.id;
  const changed = () => setRevision(n => n + 1);
  const tabs = isAdmin ? [
    { id: 'overview', label: 'Visão geral' },
    { id: 'monthly-reports', label: 'Relatórios mensais' },
    { id: 'analysis', label: 'Contestações' },
    { id: 'employees', label: 'Funcionários' },
    { id: 'course-tuitions', label: 'Mensalidades por curso' },
    { id: 'student', label: 'Consultar estudante' },
  ] : [
    { id: 'debts', label: 'Dívidas' }, { id: 'history', label: 'Histórico de pagamentos' },
    { id: 'analysis', label: 'Contestações' }, { id: 'notices', label: 'Avisos' },
    ...(isFinance ? [{ id: 'tuition', label: 'Emissão de propina' }, { id: 'report', label: 'Resumo do campus' }, { id: 'employees', label: 'Funcionários' }, { id: 'course-tuitions', label: 'Mensalidades por curso' }, { id: 'monthly-reports', label: 'Relatórios mensais' }] : []),
  ];
  const operationalTab = isAdmin && tab === 'student' ? studentSection : tab;
  const needsStudent = isFinance && ['debts', 'history', 'analysis', 'notices'].includes(tab) || isAdmin && (tab === 'student' || tab === 'analysis');
  return <div className="space-y-6">
    <PageIntro eyebrow="Finanças" title="Gestão financeira"
      description={isAdmin ? 'Acompanhar indicadores, relatórios, políticas e auditoria financeira.' : isFinance ? 'Registar operações financeiras, analisar contestações e gerir salários.' : 'Acompanhar as suas dívidas, pagamentos e pedidos de análise.'}
      actions={<><FinancialGuide role={user.role as 'ADMIN' | 'FINANCE' | 'STUDENT'} navigate={step => { if (step.tab) setTab(step.tab); if (step.section) setStudentSection(step.section); if (step.policy) setPoliciesOpen(true); }} />{isAdmin && <button data-financial-guide="policy-button" className="btn-secondary" aria-expanded={policiesOpen} aria-controls="financial-policy" onClick={() => setPoliciesOpen(!policiesOpen)}><span aria-hidden="true">⚙</span> Políticas financeiras</button>}</>} />
    <div data-financial-guide="tabs"><ChipTabs items={tabs} value={tab} onChange={setTab} ariaLabel="Secções financeiras" /></div>
    {isAdmin && policiesOpen && <div data-financial-guide="policy"><FinancialPolicy onChanged={changed} /></div>}
    {isAdmin && tab === 'student' && <nav data-financial-guide="student-sections" className="flex flex-wrap gap-2" aria-label="Dados financeiros do estudante">
      {[{ id: 'debts', label: 'Dívidas' }, { id: 'history', label: 'Histórico de pagamentos' }, { id: 'notices', label: 'Avisos' }].map(item => <button key={item.id} className={studentSection === item.id ? 'btn-primary' : 'btn-secondary'} onClick={() => setStudentSection(item.id)}>{item.label}</button>)}
    </nav>}
    {needsStudent && <div data-financial-guide="student-picker"><StudentPicker selected={selected} onSelect={setSelected} /></div>}
    {studentId && <FinancialStandingBanner key={`${studentId}:${revision}`} studentId={studentId} />}
    {isAdmin && tab === 'overview' && <AdminFinancialOverview revision={revision} onOpenReports={() => setTab('monthly-reports')} onOpenPolicies={() => setPoliciesOpen(true)} />}
    {operationalTab === 'debts' && studentId && <FinancialDebts key={`${studentId}:${revision}`} studentId={studentId} />}
    {operationalTab === 'history' && studentId && <div data-financial-guide="history"><FinancialHistory key={studentId} studentId={studentId} revision={revision} /></div>}
    {tab === 'analysis' && <div data-financial-guide="analysis"><FinancialAnalysis key={studentId ?? 'all'} studentId={studentId} manager={manager} canResolve={isFinance} onChanged={changed} /></div>}
    {operationalTab === 'notices' && studentId && <div data-financial-guide="notices"><FinancialNotifications key={studentId} studentId={studentId} manager={manager} /></div>}
    {tab === 'report' && isFinance && <FinancialReport revision={revision} />}
    {tab === 'tuition' && isFinance && <div data-financial-guide="tuition"><FinancialTuitionIssuance onCreated={changed} /></div>}
    {tab === 'employees' && manager && <FinancialSalaries />}
    {tab === 'course-tuitions' && manager && <FinancialCourseTuitions />}
    {tab === 'monthly-reports' && manager && <div data-financial-guide="monthly-reports"><FinancialMonthlyReports /></div>}
    {!studentId && manager && ['debts', 'history', 'notices'].includes(operationalTab) && <p className="surface p-4">Seleccione um estudante acima para consultar esta secção.</p>}
    {manager && tab === 'analysis' && !studentId && <p className="text-sm text-campus-deep/75">A apresentar contestações de todos os estudantes.</p>}
  </div>;
}
