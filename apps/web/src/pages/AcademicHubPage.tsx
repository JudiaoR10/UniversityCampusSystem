import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { campusModules } from '@smart-campus/shared-types';
import { HubCard } from '../components/HubCard';
import { ModuleGlyph } from '../components/ModuleGlyph';
import { PageIntro } from '../components/PageIntro';
import { StatCard } from '../components/StatCard';
import { PageBanner } from '../components/ui';
import { useAuth } from '../lib/auth';

const featured = ['assessments', 'schedules', 'attendance'];
const directory = ['departments', 'courses', 'subjects', 'students', 'teachers', 'enrolments'];

const steps = [
  { to: '/schedules', title: 'Confirme os horários', body: 'Veja o que está a decorrer hoje e ajuste sessões se precisar.' },
  { to: '/attendance', title: 'Marque presenças', body: 'A lista vem só dos inscritos activos na disciplina.' },
  { to: '/assessments', title: 'Lance notas', body: 'Publique a pauta quando a turma estiver pronta a ver os resultados.' },
];

export function AcademicHubPage() {
  const { api } = useAuth();
  const featuredItems = campusModules.filter((module) => featured.includes(module.key));
  const directoryItems = campusModules.filter((module) => directory.includes(module.key));
  const [stats, setStats] = useState({ students: null as number | null, courses: null as number | null, sessions: null as number | null });

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.students.list(), api.courses(), api.schedules()]).then(([students, courses, schedules]) => {
      if (cancelled) return;
      setStats({
        students: students.status === 'fulfilled' ? students.value.data.length : null,
        courses: courses.status === 'fulfilled' ? courses.value.data.length : null,
        sessions: schedules.status === 'fulfilled' ? schedules.value.data.length : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="space-y-8">
      <PageBanner>
        Comece pelos horários, avaliações e assiduidade. Os cadastros de cursos e pessoas ficam no directório abaixo.
      </PageBanner>
      <PageIntro
        eyebrow="Vida académica"
        title="Gestão académica"
        description="Tudo o que precisa para acompanhar disciplinas, pessoas e o dia-a-dia lectivo — no mesmo sítio."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/schedules" className="btn-primary">
              Horários de hoje
            </Link>
            <Link to="/assessments" className="btn-secondary">
              Avaliações
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Estudantes"
          value={stats.students ?? '—'}
          hint="Perfis académicos activos no Core"
          to="/students"
          icon={<ModuleGlyph name="students" />}
        />
        <StatCard
          label="Cursos"
          value={stats.courses ?? '—'}
          hint="Catálogo disponível para inscrição"
          to="/courses"
          icon={<ModuleGlyph name="courses" />}
        />
        <StatCard
          label="Sessões de horário"
          value={stats.sessions ?? '—'}
          hint="Aulas, laboratórios e avaliações calendarizadas"
          to="/schedules"
          icon={<ModuleGlyph name="schedules" />}
        />
      </section>

      <section className="hero-panel">
        <p className="eyebrow">Como começar</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <Link key={step.to} to={step.to} className="rounded-2xl bg-white/80 p-4 transition hover:bg-white">
              <p className="text-xs font-bold tracking-[0.16em] text-campus-teal">{String(index + 1).padStart(2, '0')}</p>
              <p className="mt-2 font-display text-lg font-semibold text-campus-ink">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-campus-deep/70">{step.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">O essencial desta semana</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featuredItems.map((item) => (
            <HubCard key={item.key} item={item} kicker="Em uso" featured />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="section-title">Directório</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {directoryItems.map((item) => (
            <HubCard key={item.key} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
