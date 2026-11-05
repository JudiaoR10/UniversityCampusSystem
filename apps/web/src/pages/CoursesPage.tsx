import { FormEvent, useEffect, useState } from 'react';
import type { CourseDto, DepartmentDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { SelectField } from '../components/SelectField';

export function CoursesPage() {
  const { api, user } = useAuth();
  const [cursos, setCursos] = useState<CourseDto[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartmentDto[]>([]);
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState({ code: '', name: '', description: '', departmentId: '' });
  const podeGerir = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  async function carregar(departmentId: string = filtroDepartamento) {
    try {
      const [resDepartamentos, resCursos] = await Promise.all([
        api.departments(),
        api.courses(departmentId || undefined),
      ]);
      setDepartamentos(resDepartamentos.data);
      setCursos(resCursos.data);
      const primeiro = resDepartamentos.data[0];
      setFormulario((f) => (f.departmentId || !primeiro ? f : { ...f, departmentId: primeiro.id }));
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar cursos');
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function aoMudarFiltro(valor: string) {
    setFiltroDepartamento(valor);
    void carregar(valor);
  }

  async function aoCriar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    try {
      await api.createCourse({
        code: formulario.code.trim(),
        name: formulario.name.trim(),
        description: formulario.description.trim() || undefined,
        departmentId: formulario.departmentId,
      });
      setFormulario((f) => ({ ...f, code: '', name: '', description: '' }));
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar curso');
    } finally {
      setAGuardar(false);
    }
  }

  const semDepartamentos = !aCarregar && departamentos.length === 0;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Vida académica"
        title="Cursos"
        description="Catálogo de cursos e programas, organizado por departamento."
        actions={
          <SelectField
            className="w-full sm:w-80"
            value={filtroDepartamento}
            onChange={aoMudarFiltro}
            aria-label="Filtrar por departamento"
            options={[
              { value: '', label: 'Todos os departamentos' },
              ...departamentos.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
            ]}
          />
        }
      />

      {erro ? <p className="alert-error">{erro}</p> : null}

      {podeGerir ? (
        semDepartamentos ? (
          <p className="surface p-4 text-sm text-campus-deep/80">
            Crie primeiro um departamento para poder registar cursos.
          </p>
        ) : (
          <form onSubmit={aoCriar} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
            <h2 className="section-title md:col-span-2 xl:col-span-5">Novo curso</h2>
            <input
              className="field-input !mt-0"
              placeholder="Código (ex.: LEI)"
              value={formulario.code}
              onChange={(e) => setFormulario({ ...formulario, code: e.target.value })}
              minLength={2}
              maxLength={10}
              required
            />
            <input
              className="field-input !mt-0"
              placeholder="Nome do curso"
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
            <SelectField
              value={formulario.departmentId}
              onChange={(departmentId) => setFormulario({ ...formulario, departmentId })}
              required
              placeholder="Seleccionar departamento"
              options={departamentos.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
            />
            <button type="submit" className="btn-primary w-full" disabled={aGuardar || !formulario.departmentId}>
              {aGuardar ? 'A criar...' : 'Criar curso'}
            </button>
          </form>
        )
      ) : null}

      <div className="surface table-scroll">
        <table className="min-w-[640px] text-left text-sm">
          <thead className="bg-campus-mist/80 text-campus-deep">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Departamento</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {aCarregar ? (
              <tr>
                <td className="px-4 py-3 text-campus-deep/70" colSpan={4}>
                  A carregar cursos...
                </td>
              </tr>
            ) : cursos.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-campus-deep/70" colSpan={4}>
                  Não existem cursos para mostrar.
                </td>
              </tr>
            ) : (
              cursos.map((curso) => (
                <tr key={curso.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3 font-medium">{curso.code}</td>
                  <td className="px-4 py-3">{curso.name}</td>
                  <td className="px-4 py-3">{curso.department.code}</td>
                  <td className="px-4 py-3">{curso.description ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}