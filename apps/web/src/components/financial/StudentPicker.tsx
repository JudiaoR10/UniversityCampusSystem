import { useCallback, useState, type FormEvent } from 'react';
import type { StudentIdentitySummaryDto } from '@smart-campus/shared-types';
import { useAuth } from '../../lib/auth';
import { LoadState, Pagination, useFinancialLoad } from './shared';

export function StudentPicker({ selected, onSelect }: { selected: StudentIdentitySummaryDto | null; onSelect: (student: StudentIdentitySummaryDto | null) => void }) {
  const { api } = useAuth();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(!selected);
  const load = useCallback(() => api.financialStudents({ q: search || undefined, offset, limit: 20 }), [api, search, offset]);
  const result = useFinancialLoad(load);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(String(new FormData(event.currentTarget).get('search')).trim());
    setOffset(0);
  }
  return <section className="surface space-y-4 p-4 sm:p-5" aria-label="Seleccionar estudante">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-xl font-semibold">{selected?.fullName ?? 'Seleccionar estudante'}</h2>
        <p className="text-sm text-campus-deep/75">{selected ? `${selected.studentNumber ?? 'Sem matrícula'}${selected.isActive ? '' : ' · Conta inactiva'}` : 'Pesquise um estudante registado no Core para consultar ou registar operações.'}</p></div>
      {selected && <div className="flex gap-2"><button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Trocar estudante</button><button className="btn-secondary" onClick={() => { onSelect(null); setOpen(true); }}>Limpar selecção</button></div>}
    </div>
    {open && <>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium">Nome ou matrícula<input name="search" type="search" minLength={2} maxLength={100} className="field-input" /></label>
        <button className="btn-secondary" disabled={result.loading}>Pesquisar</button>
      </form>
      <LoadState {...result} />
      {result.data && <>
        <ul className="divide-y divide-campus-line">
          {result.data.data.map(student => <li key={student.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="font-medium">{student.fullName}</p><p className="text-sm">{student.studentNumber ?? 'Sem matrícula'}{!student.isActive && ' · Conta inactiva'}</p></div>
            <button className="btn-secondary" onClick={() => { onSelect(student); setOpen(false); }}>Seleccionar <span className="sr-only">{student.fullName}</span></button>
          </li>)}
        </ul>
        {!result.data.data.length && <p>Não foram encontrados estudantes.</p>}
        <Pagination offset={offset} hasMore={!!result.data.meta.hasMore} loading={result.loading} onChange={setOffset} />
      </>}
    </>}
  </section>;
}
