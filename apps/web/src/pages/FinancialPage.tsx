import { useState } from 'react';
import type { AuthUser, StudentIdentitySummaryDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { StudentPicker } from '../components/financial/StudentPicker';
import { FinancialDebts } from '../components/financial/FinancialDebts';
import { FinancialHistory } from '../components/financial/FinancialHistory';
import { FinancialAnalysis } from '../components/financial/FinancialAnalysis';
import { FinancialPolicy } from '../components/financial/FinancialPolicy';
import { FinancialNotifications } from '../components/financial/FinancialNotifications';
import { FinancialReport } from '../components/financial/FinancialReport';
import { FinancialSalaries } from '../components/financial/FinancialSalaries';
import { FinancialMonthlyReports } from '../components/financial/FinancialMonthlyReports';

export function FinancialPage() {
  const { user } = useAuth();
  if (!user || !['STUDENT', 'FINANCE', 'ADMIN'].includes(user.role)) {
    return <p className="surface p-4 text-sm text-campus-deep sm:p-5">O seu perfil não tem acesso à gestão financeira.</p>;
  }
  return <FinancialWorkspace key={`${user.id}:${user.role}`} user={user} />;
}

function FinancialWorkspace({ user }: { user: AuthUser }) {
  const manager = ['FINANCE', 'ADMIN'].includes(user.role);
  const [selected, setSelected] = useState<StudentIdentitySummaryDto | null>(null);
  const [tab, setTab] = useState('debts');
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const studentId = manager ? selected?.userId : user.id;
  const changed = () => setRevision(n => n + 1);
  const tabs = [
    { id: 'debts', label: 'Dívidas' }, { id: 'history', label: 'Histórico de pagamentos' },
    { id: 'analysis', label: 'Contestações' }, { id: 'notices', label: 'Avisos' },
    ...(manager ? [{ id: 'report', label: 'Resumo do campus' }] : []),
    ...(manager ? [{ id: 'salaries', label: 'Salários dos docentes' }, { id: 'monthly-reports', label: 'Relatórios mensais' }] : []),
  ];
  return <div className="space-y-6">
    <PageIntro eyebrow="Finanças" title="Gestão financeira"
      description={manager ? 'Consultar estudantes, registar operações e analisar contestações.' : 'Acompanhar as suas dívidas, pagamentos e pedidos de análise.'}
      actions={user.role === 'ADMIN' && <button className="btn-secondary" aria-expanded={policiesOpen} aria-controls="financial-policy" onClick={() => setPoliciesOpen(!policiesOpen)}><span aria-hidden="true">⚙</span> Políticas financeiras</button>} />
    {user.role === 'ADMIN' && policiesOpen && <FinancialPolicy onChanged={changed} />}
    {manager && ['debts', 'history', 'analysis', 'notices'].includes(tab) && <StudentPicker selected={selected} onSelect={setSelected} />}
    <nav className="flex flex-wrap gap-2" aria-label="Secções financeiras">
      {tabs.map(item => <button key={item.id} className={tab === item.id ? 'btn-primary' : 'btn-secondary'} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </nav>
    {tab === 'debts' && studentId && <FinancialDebts key={`${studentId}:${revision}`} studentId={studentId} />}
    {tab === 'history' && studentId && <FinancialHistory key={studentId} studentId={studentId} revision={revision} />}
    {tab === 'analysis' && <FinancialAnalysis key={studentId ?? 'all'} studentId={studentId} manager={manager} onChanged={changed} />}
    {tab === 'notices' && studentId && <FinancialNotifications key={studentId} studentId={studentId} manager={manager} />}
    {tab === 'report' && manager && <FinancialReport revision={revision} />}
    {tab === 'salaries' && manager && <FinancialSalaries />}
    {tab === 'monthly-reports' && manager && <FinancialMonthlyReports />}
    {!studentId && ['debts', 'history', 'notices'].includes(tab) && <p className="surface p-4">Seleccione um estudante acima para consultar esta secção.</p>}
    {manager && tab === 'analysis' && !studentId && <p className="text-sm text-campus-deep/75">A apresentar contestações de todos os estudantes.</p>}
  </div>;
}
