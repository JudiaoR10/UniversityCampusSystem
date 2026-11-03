import { Link } from 'react-router-dom';
import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { PageIntro } from '../components/PageIntro';

const items = [
  { label: 'Departamentos', path: '/departments', status: 'development' as const },
  { label: 'Cursos', path: '/courses', status: 'development' as const },
  { label: 'Disciplinas', path: '/subjects', status: 'development' as const },
  { label: 'Estudantes', path: '/students', status: 'partial' as const },
  { label: 'Docentes', path: '/teachers', status: 'partial' as const },
  { label: 'Matrículas', path: '/enrolments', status: 'development' as const },
];

export function AcademicHubPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Vida académica"
        title="Gestão académica"
        description="Hub parcial do Core. Entidades de base existem na base de dados; endpoints e UI completos ficam a cargo do grupo académico."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link key={item.path} to={item.path} className="surface-interactive block p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-campus-ink">{item.label}</span>
              <ModuleStatusBadge status={item.status} tone="light" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
