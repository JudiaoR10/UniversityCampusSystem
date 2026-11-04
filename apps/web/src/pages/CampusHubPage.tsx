import { Link } from 'react-router-dom';
import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { PageIntro } from '../components/PageIntro';

const items = [
  { label: 'Edifícios', path: '/buildings', status: 'available' as const },
  { label: 'Salas', path: '/rooms', status: 'available' as const },
  { label: 'Estacionamento', path: '/parking', status: 'available' as const },
  { label: 'Laboratórios', path: '/laboratories', status: 'available' as const },
  { label: 'Equipamentos', path: '/equipment', status: 'available' as const },
];

export function CampusHubPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Espaço físico"
        title="Campus físico"
        description="Edifícios, salas e activos do campus — a base espacial do Smart Campus."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
