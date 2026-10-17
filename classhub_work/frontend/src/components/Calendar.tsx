import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { eventColor } from '../lib/colors';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const typeChip: Record<string, string> = {
  PROVA: 'bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-300',
  TRABALHO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300',
  AULA: 'bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300',
};

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

export function eventTypeChip(type: string) {
  return typeChip[type] || 'bg-slate-100 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300';
}

export default function Calendar({
  events,
  selectedDate,
  onSelectDate,
}: {
  events: any[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const byDay = new Map<string, any[]>();

  events.forEach((event) => {
    const key = dayKey(new Date(event.event_date));

    byDay.set(key, [...(byDay.get(key) || []), event]);
  });

  function shift(delta: number) {
    setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
  }

  function goToday() {
    setView(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(dayKey(today));
  }

  const first = new Date(view.getFullYear(), view.getMonth(), 1);

  const startOffset = first.getDay();

  const cells: Date[] = [];

  for (let index = 0; index < 42; index++) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), 1 - startOffset + index));
  }

  const monthLabel = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const todayKeyStr = dayKey(today);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="btn-secondary px-2" onClick={() => shift(-1)}>
          <ChevronLeft size={16} />
        </button>

        <h3 className="font-bold text-lg capitalize">{monthLabel}</h3>

        <div className="flex gap-2">
          <button className="btn-secondary text-sm px-3 py-2" onClick={goToday}>
            Hoje
          </button>

          <button className="btn-secondary px-2" onClick={() => shift(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div key={dayKey(view)} className="grid grid-cols-7 gap-1 page-in">
        {cells.map((day) => {
          const key = dayKey(day);
          const inMonth = day.getMonth() === view.getMonth();
          const isToday = key === todayKeyStr;
          const isSelected = key === selectedDate;
          const dayEvents = byDay.get(key) || [];

          return (
            <button
              key={key}
              onClick={() => onSelectDate(key)}
              className={`h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition
                ${inMonth ? '' : 'opacity-30'}
                ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25 scale-105'
                    : isToday
                      ? 'ring-2 ring-violet-500 text-violet-700 font-black bg-violet-50/60'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              <span className="text-sm leading-none">{day.getDate()}</span>

              {dayEvents.length > 0 && (
                <span className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((event: any, index: number) => (
                    <span
                      key={index}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: eventColor(event) }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] leading-none font-bold text-slate-400 -mt-0.5">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
