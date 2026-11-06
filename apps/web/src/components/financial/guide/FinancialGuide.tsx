import { useEffect, useRef, useState } from 'react';

type GuideRole = 'ADMIN' | 'FINANCE' | 'STUDENT';
type Step = { title: string; text: string; target: string; tab?: string; section?: string; policy?: boolean };
type Guide = { title: string; roles: GuideRole[]; steps: Step[] };

const picker: Step = { title: 'Escolher estudante', text: 'Pesquise e seleccione um estudante para consultar os seus dados. Enquanto não escolher um, as secções individuais não aparecem.', target: 'student-picker' };
const debts: Step = { title: 'Consultar dívidas', text: 'Use os filtros para encontrar cobranças por estado, origem ou vencimento.', target: 'debt-filters', tab: 'debts' };
const list: Step = { title: 'Lista de dívidas', text: 'Veja a descrição, o valor, o vencimento e o estado. As acções dependem do seu perfil e do estado da dívida.', target: 'debt-list', tab: 'debts' };
const guides: Guide[] = [
  { title: 'Consultar dívidas e pagamentos', roles: ['STUDENT'], steps: [debts, list, { title: 'Histórico de pagamentos', text: 'Consulte aqui os pagamentos registados e os totais da sua situação financeira.', target: 'history', tab: 'history' }] },
  { title: 'Contestar uma cobrança', roles: ['STUDENT'], steps: [debts, { ...list, text: 'Numa dívida pendente ou vencida, escolha Contestar. Preencha a justificação e confirme apenas se pretender submetê-la.' }, { title: 'Acompanhar contestação', text: 'Consulte o estado e a decisão dos pedidos nesta secção.', target: 'analysis', tab: 'analysis' }] },
  { title: 'Consultar avisos', roles: ['STUDENT'], steps: [{ title: 'Avisos', text: 'Consulte as notificações financeiras disponíveis para a sua conta.', target: 'notices', tab: 'notices' }] },
  { title: 'Registar dívida e pagamento', roles: ['FINANCE'], steps: [{ ...picker, tab: 'debts' }, { title: 'Nova dívida', text: 'Depois de seleccionar o estudante, preencha descrição, valor, origem e vencimento. Confirme os dados antes de registar.', target: 'debt-create', tab: 'debts' }, { ...list, text: 'Numa dívida pendente ou vencida, escolha Registar pagamento. Preencha o formulário e confirme apenas após verificar o pagamento recebido.' }] },
  { title: 'Analisar contestações', roles: ['FINANCE'], steps: [{ title: 'Contestações', text: 'Filtre os pedidos e escolha Analisar num pedido pendente. Leia a justificação antes de decidir; a decisão é registada ao confirmar.', target: 'analysis', tab: 'analysis' }] },
  { title: 'Gerir salários', roles: ['FINANCE'], steps: [{ title: 'Pesquisar funcionário', text: 'Pesquise pelo nome, código ou função e utilize os filtros disponíveis.', target: 'employees-search', tab: 'employees' }, { title: 'Propor salário', text: 'No cartão de um funcionário activo, escolha a proposta salarial. O administrador deve aprová-la antes de produzir efeito. É necessário existir um funcionário na lista.', target: 'employees-list', tab: 'employees' }] },
  { title: 'Emitir propinas', roles: ['FINANCE'], steps: [{ title: 'Emissão de propina', text: 'Escolha o curso, o ano lectivo e os restantes dados solicitados. Reveja-os antes de emitir as cobranças.', target: 'tuition', tab: 'tuition' }] },
  { title: 'Consultar estudante', roles: ['ADMIN'], steps: [{ ...picker, tab: 'student' }, { title: 'Dados financeiros', text: 'Escolha Dívidas, Histórico de pagamentos ou Avisos. Primeiro seleccione um estudante.', target: 'student-sections', tab: 'student' }] },
  { title: 'Decidir propostas salariais', roles: ['ADMIN'], steps: [{ title: 'Pesquisar funcionário', text: 'Consulte o quadro de pessoal e os filtros.', target: 'employees-search', tab: 'employees' }, { title: 'Aprovações salariais', text: 'Reveja cada proposta pendente e a respectiva justificação antes de aprovar ou rejeitar. Se não houver propostas, a lista estará vazia.', target: 'salary-approvals', tab: 'employees' }] },
  { title: 'Consultar relatórios', roles: ['ADMIN', 'FINANCE'], steps: [{ title: 'Relatórios mensais', text: 'Escolha o tipo de relatório e o mês. Pode consultar os resultados e imprimir o relatório disponível.', target: 'monthly-reports', tab: 'monthly-reports' }] },
  { title: 'Configurar políticas', roles: ['ADMIN'], steps: [{ title: 'Políticas financeiras', text: 'Consulte os parâmetros e reveja as alterações antes de as guardar.', target: 'policy', policy: true }] },
];

export function FinancialGuide({ role, navigate }: { role: GuideRole; navigate: (step: Step) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Guide | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const step = active?.steps[index];

  const close = () => { setOpen(false); setActive(null); setRect(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // O botão de assunto desaparece ao iniciar; manter o foco no guia facilita o teclado.
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [active, open]);

  useEffect(() => {
    if (!step) return;
    navigate(step);
  // Navigation is deliberately tied to the selected step, not unrelated page renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (!step) return;
    let revealedTarget: HTMLElement | null = null;
    const update = () => {
      const target = document.querySelector<HTMLElement>(`[data-financial-guide="${step.target}"]`);
      if (target && target !== revealedTarget) {
        revealedTarget = target;
        target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }
      setRect(target?.getBoundingClientRect() ?? null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [step]);

  return <>
    <button ref={trigger} type="button" className="btn-secondary" aria-expanded={open} aria-controls="financial-guide" onClick={() => { if (open) close(); else setOpen(true); }}><span aria-hidden="true">?</span> Guia</button>
    {open && <div ref={panel} id="financial-guide" role="region" aria-label="Guia financeiro" tabIndex={-1} className="surface fixed inset-x-3 bottom-3 z-50 max-h-[45vh] space-y-3 overflow-y-auto p-4 text-left shadow-lg sm:left-auto sm:right-6 sm:w-[26rem]">
      {!active ? <>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Como podemos ajudar?</h2><p className="text-sm text-campus-deep/75">Escolha um assunto para iniciar o guia. Prima Esc para fechar.</p></div><button type="button" className="btn-secondary" onClick={close} aria-label="Fechar guia">×</button></div>
        <div className="grid gap-2">{guides.filter(guide => guide.roles.includes(role)).map(guide => <button type="button" className="btn-secondary justify-start text-left" key={guide.title} onClick={() => { setIndex(0); setActive(guide); }}>{guide.title}</button>)}</div>
      </> : <>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-campus-deep/70">{active.title} · {index + 1} / {active.steps.length}</p><h2 className="font-display text-lg font-semibold">{step?.title}</h2></div><button type="button" className="btn-secondary" onClick={close} aria-label="Fechar guia">×</button></div>
        <p className="text-sm" aria-live="polite">{step?.text}</p>
        <p className="text-xs text-campus-deep/75">{rect ? 'A área indicada está contornada.' : 'Esta área ainda não está disponível. Verifique a selecção ou os dados necessários; pode continuar ou fechar o guia.'}</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setActive(null)}>Assuntos</button><button type="button" className="btn-secondary" disabled={index === 0} onClick={() => setIndex(value => value - 1)}>Anterior</button><button type="button" className="btn-primary" onClick={() => index === active.steps.length - 1 ? close() : setIndex(value => value + 1)}>{index === active.steps.length - 1 ? 'Terminar' : 'Próximo'}</button></div>
      </>}
    </div>}
    {open && step && rect && <div data-financial-guide-highlight aria-hidden="true" className="pointer-events-none fixed z-40 rounded-xl border-4 shadow-lg" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8, borderColor: 'var(--campus-teal)' }} />}
  </>;
}
