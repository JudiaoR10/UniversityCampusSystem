import { Link } from 'react-router-dom';
import type { CampusModule } from '@smart-campus/shared-types';
import { ModuleGlyph } from './ModuleGlyph';
import { ModuleStatusBadge } from './ModuleStatusBadge';

export function HubCard({
  item,
  kicker,
  featured = false,
  stat,
}: {
  item: CampusModule;
  kicker?: string;
  featured?: boolean;
  stat?: string;
}) {
  return (
    <Link
      to={item.path}
      className={`surface-interactive hub-card block p-5 ${featured ? 'sm:p-6' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`icon-well ${featured ? '!h-12 !w-12' : ''}`}>
          <ModuleGlyph name={item.key} className={featured ? 'h-6 w-6' : ''} />
        </span>
        {item.status !== 'available' ? <ModuleStatusBadge status={item.status} tone="light" /> : null}
      </div>
      {kicker ? <p className="eyebrow mt-4">{kicker}</p> : null}
      <p className={`font-medium text-campus-ink ${featured ? 'mt-1 font-display text-xl' : 'mt-3'}`}>
        {item.label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-campus-deep/70">{item.description}</p>
      {stat ? <p className="mt-3 text-sm font-semibold text-campus-ink">{stat}</p> : null}
      <p className="mt-4 text-xs font-semibold text-campus-teal">Abrir módulo →</p>
    </Link>
  );
}
