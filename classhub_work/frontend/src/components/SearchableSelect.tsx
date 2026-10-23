import { useRef, useState } from 'react';
import { ChevronDown, CalendarDays, Building2 } from 'lucide-react';

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  icon: Icon,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: typeof Building2 | typeof CalendarDays;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? options.filter((o) => normalize(o).includes(normalize(query)))
    : options;

  function pick(option: string) {
    setQuery(option);
    onChange(option);
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
      )}
      <input
        ref={inputRef}
        className={`input ${Icon ? 'pl-10' : ''} pr-10`}
        value={open ? query : value}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          onChange(e.target.value);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => (filtered.length ? Math.min(h + 1, filtered.length - 1) : 0));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => (filtered.length ? Math.max(h - 1, 0) : 0));
          } else if (e.key === 'Enter' && open && filtered[highlight]) {
            e.preventDefault();
            pick(filtered[highlight]);
          }
        }}
      />
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        size={17}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-[#14141a]">
          {filtered.map((option, i) => (
            <li key={option}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  option === value
                    ? 'font-semibold text-violet-600 dark:text-violet-400'
                    : 'text-slate-700 dark:text-slate-200'
                } ${i === highlight ? 'bg-violet-50 dark:bg-slate-800' : ''}`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
