import { useEffect, useState } from 'react';

export const money = (value: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);
export const date = (value: string) => new Date(value).toLocaleDateString('pt-MZ');
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.';

// Ignora respostas de consultas que já deixaram de ser a selecção actual.
export function useFinancialLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(undefined);
    setError('');
    load().then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, attempt]);
  return { data, loading, error, reload: () => setAttempt(n => n + 1) };
}

export function LoadState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  return <>
    {loading && <p role="status">A carregar...</p>}
    {error && <div role="alert" className="space-y-2 text-red-700"><p>{error}</p><button className="btn-secondary" onClick={reload}>Tentar novamente</button></div>}
  </>;
}

export function Pagination({ offset, hasMore, loading, onChange }: { offset: number; hasMore: boolean; loading: boolean; onChange: (offset: number) => void }) {
  return <div className="flex flex-wrap items-center gap-3">
    <button className="btn-secondary" disabled={loading || offset === 0} onClick={() => onChange(Math.max(0, offset - 20))}>Anterior</button>
    <span className="text-sm">Página {offset / 20 + 1}</span>
    <button className="btn-secondary" disabled={loading || !hasMore} onClick={() => onChange(offset + 20)}>Seguinte</button>
  </div>;
}
