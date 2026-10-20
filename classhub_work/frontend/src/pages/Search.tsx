import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, FileText, Search, SearchX } from 'lucide-react';
import { api } from '../lib/api';

type Results = {
  materials: { id: string; title: string; type: string; subject_id: string; subject_name: string }[];
  events: {
    id: string;
    title: string;
    event_date: string;
    type: string;
    subject_id: string | null;
    subject_name: string | null;
  }[];
  notices: { id: string; title: string; pinned: boolean; created_at: string; subject_name: string | null }[];
};

const EMPTY: Results = { materials: [], events: [], notices: [] };

const typeLabels: Record<string, string> = {
  PROVA: 'Prova',
  TRABALHO: 'Trabalho',
  AULA: 'Aula',
  OUTRO: 'Outro',
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/search', { params: { q } });
        setResults(r.data);
        setSearched(true);
      } catch {
        setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const total = results.materials.length + results.events.length + results.notices.length;

  return (
    <div>
      <h2 className="section-title mb-6">Busca</h2>

      <div className="card p-4 md:p-6 mb-6">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busque materiais, eventos, dúvidas e avisos… (mín. 2 caracteres)"
            className="input pl-10 text-base"
          />
        </div>
        <p className="muted mt-2">
          Digite ao menos 2 letras — a busca acontece automaticamente enquanto você digita.
        </p>
      </div>

      {loading && (
        <div className="card p-8 text-center">
          <span className="muted">Buscando…</span>
        </div>
      )}

      {!loading && searched && total === 0 && (
        <div className="card p-10 text-center">
          <SearchX size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-bold">Nada encontrado</p>
          <p className="muted mt-1">Tente outros termos ou verifique a grafia.</p>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {results.materials.length > 0 && (
            <section className="card p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <FileText size={18} className="text-violet-600" /> Materiais
              </h3>
              <ul className="space-y-2">
                {results.materials.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/disciplinas/${m.subject_id}`}
                      className="block rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <p className="font-semibold text-sm">{m.title}</p>
                      <p className="muted text-xs mt-0.5">{m.subject_name}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.events.length > 0 && (
            <section className="card p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <CalendarDays size={18} className="text-amber-600" /> Agenda
              </h3>
              <ul className="space-y-2">
                {results.events.map((e) => (
                  <li key={e.id}>
                    <Link
                      to="/agenda"
                      className="block rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <p className="font-semibold text-sm">{e.title}</p>
                      <p className="muted text-xs mt-0.5">
                        {typeLabels[e.type] || 'Evento'} ·{' '}
                        {new Date(e.event_date).toLocaleDateString('pt-BR')}
                        {e.subject_name ? ` · ${e.subject_name}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.notices.length > 0 && (
            <section className="card p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Bell size={18} className="text-rose-600" /> Avisos
              </h3>
              <ul className="space-y-2">
                {results.notices.map((n) => (
                  <li key={n.id}>
                    <Link
                      to="/disciplinas"
                      className="block rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <p className="font-semibold text-sm">
                        {n.pinned && <span className="chip mr-2">fixado</span>}
                        {n.title}
                      </p>
                      <p className="muted text-xs mt-0.5">
                        {new Date(n.created_at).toLocaleDateString('pt-BR')}
                        {n.subject_name ? ` · ${n.subject_name}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
