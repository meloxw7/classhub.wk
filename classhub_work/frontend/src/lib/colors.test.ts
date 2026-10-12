import { describe, it, expect } from 'vitest';
import { subjectColor, initials, eventColor, progressTone, EVENT_COLORS } from './colors';

describe('subjectColor', () => {
  it('é determinística: mesmo nome, mesma cor', () => {
    expect(subjectColor('Matemática')).toBe(subjectColor('Matemática'));
  });

  it('devolve sempre uma classe da paleta', () => {
    for (const name of ['A', 'B', 'C', 'Disciplina Longa', 'x y z']) {
      expect(subjectColor(name)).toMatch(/^bg-\w+-100 text-\w+-700$/);
    }
  });
});

describe('initials', () => {
  it('usa as duas primeiras palavras', () => {
    expect(initials('Sistemas Operacionais')).toBe('SO');
    expect(initials('Alice Silva')).toBe('AS');
  });

  it('ignora espaços extras e nomes curtos', () => {
    expect(initials('  Banco   de Dados ')).toBe('BD');
    expect(initials('Física')).toBe('F');
    expect(initials('')).toBe('');
  });
});

describe('eventColor', () => {
  it('respeita cor customizada do evento (com #)', () => {
    expect(eventColor({ color: '#123456', type: 'PROVA' })).toBe('#123456');
  });

  it('normaliza cor sem #', () => {
    expect(eventColor({ color: 'abc123', type: 'AULA' })).toBe('#abc123');
  });

  it('cai na cor do tipo quando não há cor', () => {
    expect(eventColor({ type: 'PROVA' })).toBe('#dc2626');
    expect(eventColor({ type: 'TRABALHO' })).toBe('#f59e0b');
    expect(eventColor({ type: 'AULA' })).toBe('#2563eb');
  });

  it('usa cinza como fallback', () => {
    expect(eventColor({ type: 'OUTRO' })).toBe('#64748b');
    expect(eventColor({})).toBe('#64748b');
  });
});

describe('progressTone', () => {
  it('classifica os intervalos de progresso', () => {
    expect(progressTone(100)).toBe('bg-emerald-500');
    expect(progressTone(80)).toBe('bg-emerald-500');
    expect(progressTone(79)).toBe('bg-amber-500');
    expect(progressTone(50)).toBe('bg-amber-500');
    expect(progressTone(49)).toBe('bg-red-500');
    expect(progressTone(0)).toBe('bg-red-500');
  });
});

describe('EVENT_COLORS', () => {
  it('tem cores hex válidas', () => {
    expect(EVENT_COLORS.length).toBeGreaterThan(0);
    for (const c of EVENT_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});
