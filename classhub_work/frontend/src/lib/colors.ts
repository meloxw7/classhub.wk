const PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
];

export function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export const EVENT_COLORS = [
  '#dc2626',
  '#f59e0b',
  '#059669',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0ea5e9',
  '#475569',
];

const typeColors: Record<string, string> = {
  PROVA: '#dc2626',
  TRABALHO: '#f59e0b',
  AULA: '#2563eb',
};

export function eventColor(event: any) {
  if (event.color && event.color.startsWith('#')) {
    return event.color;
  }

  if (event.color) {
    return `#${event.color}`;
  }

  return typeColors[event.type] || '#64748b';
}

export function progressTone(p: number) {
  return p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500';
}
