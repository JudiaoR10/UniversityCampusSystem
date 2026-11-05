import type { ReactNode } from 'react';

type GlyphFamily = 'map' | 'book' | 'people' | 'building' | 'sensor' | 'alert' | 'chart' | 'gear' | 'car' | 'cube';

const familyByKey: Record<string, GlyphFamily> = {
  ops: 'map',
  dashboard: 'chart',
  reports: 'chart',
  financial: 'chart',
  academic: 'book',
  departments: 'book',
  courses: 'book',
  subjects: 'book',
  assessments: 'book',
  schedules: 'book',
  attendance: 'book',
  enrolments: 'book',
  users: 'people',
  students: 'people',
  teachers: 'people',
  campus: 'building',
  buildings: 'building',
  rooms: 'building',
  laboratories: 'building',
  equipment: 'building',
  'campus-twin': 'cube',
  iot: 'sensor',
  devices: 'sensor',
  sensors: 'sensor',
  readings: 'sensor',
  parking: 'car',
  incidents: 'alert',
  alerts: 'alert',
  notifications: 'alert',
  maintenance: 'gear',
  admin: 'gear',
  audit: 'gear',
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden>
      {children}
    </svg>
  );
}

const glyphs: Record<GlyphFamily, ReactNode> = {
  map: (
    <Icon>
      <path d="M4 7.5 9 5l6 3 5-2.5V17l-5 2.5-6-3-5 2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 5v11.5M15 8v11.5" stroke="currentColor" strokeWidth="1.7" />
    </Icon>
  ),
  book: (
    <Icon>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v14.5H7.5A2.5 2.5 0 0 0 5 21Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 8h8M8 11.5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Icon>
  ),
  people: (
    <Icon>
      <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 18c.6-3 2.4-4.5 4.5-4.5S13 15 13.6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16.2" cy="8.4" r="1.9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 13.6c1.7.2 3.1 1.4 3.7 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Icon>
  ),
  building: (
    <Icon>
      <path d="M5 20V7.5L12 4l7 3.5V20" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 10h.1M12 10h.1M15.5 10h.1M8.5 13.5h.1M15.5 13.5h.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </Icon>
  ),
  sensor: (
    <Icon>
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 7.4a6.5 6.5 0 0 1 0 9.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 5a9.9 9.9 0 0 0 0 14M19 5a9.9 9.9 0 0 1 0 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Icon>
  ),
  alert: (
    <Icon>
      <path d="M12 4.5 20.5 19h-17Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 10v4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="0.8" fill="currentColor" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 16v-4.5M12 16V8M17 16v-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Icon>
  ),
  gear: (
    <Icon>
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 4.5v1.8M12 17.7V19.5M4.5 12h1.8M17.7 12H19.5M6.4 6.4l1.3 1.3M16.3 16.3l1.3 1.3M17.6 6.4l-1.3 1.3M7.7 16.3l-1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Icon>
  ),
  car: (
    <Icon>
      <path d="M5 14.5 6.4 10c.3-1 1.2-1.7 2.3-1.7h6.6c1.1 0 2 .7 2.3 1.7l1.4 4.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 14.5h15v3.2a1.5 1.5 0 0 1-1.5 1.5h-1.2M8.2 19.2H6A1.5 1.5 0 0 1 4.5 17.7v-3.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.2" cy="19.2" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15.8" cy="19.2" r="1.5" stroke="currentColor" strokeWidth="1.6" />
    </Icon>
  ),
  cube: (
    <Icon>
      <path d="M12 4.5 19.5 8.5v7L12 19.5 4.5 15.5v-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 19.5V12M12 12 4.5 8.5M12 12l7.5-3.5" stroke="currentColor" strokeWidth="1.7" />
    </Icon>
  ),
};

export function ModuleGlyph({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`inline-block h-[1.15rem] w-[1.15rem] shrink-0 ${className}`}>{glyphs[familyByKey[name] ?? 'building']}</span>;
}
