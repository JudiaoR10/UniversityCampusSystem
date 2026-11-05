import { FormEvent, useEffect, useState } from 'react';
import type { DepartmentDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { DeleteAction, TableActions } from '../components/ActionButtons';

const FORMULARIO_VAZIO = { code: '', name: '', description: '' };

export function DepartmentsPage() {
  const { api, user } = useAuth();
  const [departamentos, setDepartamentos] = useState<DepartmentDto[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [idAEliminar, setIdAEliminar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const podeGerir = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  async function carregar() {
    try {
      const res = await api.departments();
      setDepartamentos(res.data);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar departamentos');
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function aoCriar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    try {
      await api.createDepartment({
        code: formulario.code.trim(),
        name: formulario.name.trim(),
        description: formulario.description.trim() || undefined,
      });
      setFormulario(FORMULARIO_VAZIO);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar departamento');
    } finally {
      setAGuardar(false);
    }
  }

  async function aoEliminar(departamento: DepartmentDto) {
    if (!window.confirm(`Eliminar o departamento ${departamento.code} — ${departamento.name}?`)) return;
    setErro(null);
    setIdAEliminar(departamento.id);
    try {
      await api.deleteDepartment(departamento.id);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao eliminar departamento');
    } finally {
      setIdAEliminar(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Vida académica"
        title="Departamentos"
        description="Estrutura departamental da universidade."
      />

      {erro ? <p className="alert-error">{erro}</p> : null}

      {podeGerir ? (
        <form onSubmit={aoCriar} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          <h2 className="section-title md:col-span-2 xl:col-span-4">Novo departamento</h2>
          <input
            className="field-input !mt-0"
            placeholder="Código (ex.: DEI)"
            value={formulario.code}
            onChange={(e) => setFormulario({ ...formulario, code: e.target.value })}
            minLength={2}
            maxLength={20}
            required
          />
          <input
            className="field-input !mt-0"
            placeholder="Nome do departamento"
            value={formulario.name}
            onChange={(e) => setFormulario({ ...formulario, name: e.target.value })}
            minLength={3}
            maxLength={120}
            required
          />
          <input
            className="field-input !mt-0"
            placeholder="Descrição (opcional)"
            value={formulario.description}
            onChange={(e) => setFormulario({ ...formulario, description: e.target.value })}
            maxLength={500}
          />
          <button type="submit" className="btn-primary w-full" disabled={aGuardar}>
            {aGuardar ? 'A criar...' : 'Criar departamento'}
          </button>
        </form>
      ) : null}

      <div className="surface table-scroll">
        <table className="min-w-[640px] text-left text-sm">
          <thead className="bg-campus-mist/80 text-campus-deep">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
              {podeGerir ? <th className="px-4 py-3 font-semibold">Acções</th> : null}
            </tr>
          </thead>
          <tbody>
            {aCarregar ? (
              <tr>
                <td className="px-4 py-3 text-campus-deep/70" colSpan={podeGerir ? 4 : 3}>
                  A carregar departamentos...
                </td>
              </tr>
            ) : departamentos.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-campus-deep/70" colSpan={podeGerir ? 4 : 3}>
                  Ainda não existem departamentos registados.
                </td>
              </tr>
            ) : (
              departamentos.map((departamento) => (
                <tr key={departamento.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3 font-medium">{departamento.code}</td>
                  <td className="px-4 py-3">{departamento.name}</td>
                  <td className="px-4 py-3">{departamento.description ?? '—'}</td>
                  {podeGerir ? (
                    <td className="px-4 py-3">
                      <TableActions>
                        <DeleteAction
                          busy={idAEliminar === departamento.id}
                          disabled={idAEliminar === departamento.id}
                          onClick={() => void aoEliminar(departamento)}
                        />
                      </TableActions>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}