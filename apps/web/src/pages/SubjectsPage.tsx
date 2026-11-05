import { FormEvent, useEffect, useState } from 'react';
import type { CourseDto, SubjectDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { SelectField } from '../components/SelectField';

export function SubjectsPage() {
  const { api, user } = useAuth();
  const [disciplinas, setDisciplinas] = useState<SubjectDto[]>([]);
  const [cursos, setCursos] = useState<CourseDto[]>([]);
  const [filtroCurso, setFiltroCurso] = useState('');
  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState({ code: '', name: '', credits: 6, courseId: '' });
  const podeGerir = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  async function carregar(courseId: string = filtroCurso) {
    try {
      const [resCursos, resDisciplinas] = await Promise.all([
        api.courses(),
        api.subjects(courseId || undefined),
      ]);
      setCursos(resCursos.data);
      setDisciplinas(resDisciplinas.data);
      const primeiro = resCursos.data[0];
      setFormulario((f) => (f.courseId || !primeiro ? f : { ...f, courseId: primeiro.id }));
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar disciplinas');
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function aoMudarFiltro(valor: string) {
    setFiltroCurso(valor);
    void carregar(valor);
  }

  async function aoCriar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    try {
      await api.createSubject({
        code: formulario.code.trim(),
        name: formulario.name.trim(),
        credits: Number(formulario.credits),
        courseId: formulario.courseId,
      });
      setFormulario((f) => ({ ...f, code: '', name: '' }));
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar disciplina');
    } finally {
      setAGuardar(false);
    }
  }

  const semCursos = !aCarregar && cursos.length === 0;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Vida académica"
        title="Disciplinas"
        description="Disciplinas e planos curriculares, organizados por curso."
        actions={
          <SelectField
            className="w-full sm:w-80"
            value={filtroCurso}
            onChange={aoMudarFiltro}
            aria-label="Filtrar por curso"
            options={[
              { value: '', label: 'Todos os cursos' },
              ...cursos.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
            ]}
          />
        }
      />

      {erro ? <p className="alert-error">{erro}</p> : null}

      {podeGerir ? (
        semCursos ? (
          <p className="surface p-4 text-sm text-campus-deep/80">
            Crie primeiro um curso para poder registar disciplinas.
          </p>
        ) : (
          <form onSubmit={aoCriar} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
            <h2 className="section-title md:col-span-2 xl:col-span-5">Nova disciplina</h2>
            <input
              className="field-input !mt-0"
              placeholder="Código (ex.: PTP3)"
              value={formulario.code}
              onChange={(e) => setFormulario({ ...formulario, code: e.target.value })}
              minLength={2}
              maxLength={10}
              required
            />
            <input
              className="field-input !mt-0"
              placeholder="Nome da disciplina"
              value={formulario.name}
              onChange={(e) => setFormulario({ ...formulario, name: e.target.value })}
              minLength={3}
              maxLength={120}
              required
            />
            <input
              className="field-input !mt-0"
              type="number"
              min={1}
              step={1}
              placeholder="Créditos"
              value={formulario.credits}
              onChange={(e) => setFormulario({ ...formulario, credits: Number(e.target.value) })}
              required
            />
            <SelectField
              value={formulario.courseId}
              onChange={(courseId) => setFormulario({ ...formulario, courseId })}
              required
              placeholder="Seleccionar curso"
              options={cursos.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            />
            <button type="submit" className="btn-primary w-full" disabled={aGuardar || !formulario.courseId}>
              {aGuardar ? 'A criar...' : 'Criar disciplina'}
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
              <th className="px-4 py-3 font-semibold">Curso</th>
              <th className="px-4 py-3 font-semibold">Créditos</th>
            </tr>
          </thead>
          <tbody>
            {aCarregar ? (
              <tr>
                <td className="px-4 py-3 text-campus-deep/70" colSpan={4}>
                  A carregar disciplinas...
                </td>
              </tr>
            ) : disciplinas.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-campus-deep/70" colSpan={4}>
                  Não existem disciplinas para mostrar.
                </td>
              </tr>
            ) : (
              disciplinas.map((disciplina) => (
                <tr key={disciplina.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3 font-medium">{disciplina.code}</td>
                  <td className="px-4 py-3">{disciplina.name}</td>
                  <td className="px-4 py-3">{disciplina.course.code}</td>
                  <td className="px-4 py-3">{disciplina.credits}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}