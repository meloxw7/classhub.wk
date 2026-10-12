import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileWarning,
  GraduationCap,
  Inbox,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton, SkeletonCard } from '../components/Feedback';
import { initials, subjectColor } from '../lib/colors';

function urgency(dueDate: string) {
  const diffH = (new Date(dueDate).getTime() - Date.now()) / 3600000;

  if (diffH < 24)
    return {
      label: 'MENOS DE 24H',
      chip: 'bg-red-600 text-white',
      bar: 'bg-red-600',
    };

  if (diffH < 48)
    return {
      label: 'MENOS DE 48H',
      chip: 'bg-orange-500 text-white',
      bar: 'bg-orange-500',
    };

  if (diffH <= 7 * 24)
    return {
      label: 'ESTA SEMANA',
      chip: 'bg-yellow-400 text-yellow-950',
      bar: 'bg-yellow-400',
    };

  return {
    label: 'COM CALMA',
    chip: 'bg-emerald-500 text-white',
    bar: 'bg-emerald-500',
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.all([api.get('/assignments'), api.get('/events'), api.get('/subjects')])
      .then(([a, b, c]) => {
        if (!mounted) return;
        setAssignments(a.data);
        setEvents(b.data);
        setSubjects(c.data);
      })
      .catch(() => {
        toast.error('Não foi possível carregar o dashboard.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [toast]);

  const now = new Date();

  const isStudent = user?.role === 'ALUNO';

  const pending = isStudent
    ? assignments.filter((a) => !a.submission_id && new Date(a.due_date) >= now)
    : assignments.filter((a) => new Date(a.due_date) >= now);

  const overdue = isStudent
    ? assignments.filter((a) => !a.submission_id && new Date(a.due_date) < now)
    : [];

  const completed = isStudent ? assignments.filter((a) => a.submission_id) : [];

  const receivedCount = assignments.reduce((sum, a) => sum + (a.submission_count ?? 0), 0);

  const pendingGradingCount = assignments.reduce((sum, a) => sum + (a.pending_grading ?? 0), 0);

  const provas = events.filter((e) => e.type === 'PROVA' && new Date(e.event_date) >= now);

  const upcoming = [...pending]
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  const bySubject = subjects
    .map((s) => ({
      ...s,
      count: assignments.filter((a) => a.subject_id === s.id).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const statCards = isStudent
    ? [
        {
          label: 'Total de tarefas',
          value: assignments.length,
          icon: ClipboardCheck,
          bg: 'bg-blue-50 text-blue-600',
        },
        {
          label: 'Provas',
          value: provas.length,
          icon: GraduationCap,
          bg: 'bg-violet-50 text-violet-600',
        },
        {
          label: 'Atrasadas',
          value: overdue.length,
          icon: FileWarning,
          bg: overdue.length ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400',
        },
        {
          label: 'Concluídas',
          value: completed.length,
          icon: CheckCircle2,
          bg: 'bg-emerald-50 text-emerald-600',
        },
      ]
    : [
        {
          label: 'Total de tarefas',
          value: assignments.length,
          icon: ClipboardCheck,
          bg: 'bg-blue-50 text-blue-600',
        },
        {
          label: 'Provas',
          value: provas.length,
          icon: GraduationCap,
          bg: 'bg-violet-50 text-violet-600',
        },
        {
          label: 'Entregas recebidas',
          value: receivedCount,
          icon: Inbox,
          bg: 'bg-sky-50 text-sky-600',
        },
        {
          label: 'Pendentes de correção',
          value: pendingGradingCount,
          icon: FileWarning,
          bg: pendingGradingCount ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400',
        },
      ];

  return (
    <div>
      <div className="mb-7">
        <p className="text-blue-600 font-semibold">Visão geral</p>

        <h2 className="section-title mt-1">Dashboard</h2>

        <p className="muted mt-2">
          {user?.role === 'PROFESSOR'
            ? 'Gerencie entregas e acompanhe a turma.'
            : 'Suas entregas, prazos e urgências em um só lugar.'}
        </p>
      </div>

      {/* 4 CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card) => (
              <div className="card p-5" key={card.label}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{card.label}</p>

                    <p
                      className={`text-3xl font-black mt-2 ${
                        card.label === 'Atrasadas' && overdue.length ? 'text-red-600' : ''
                      }`}
                    >
                      {card.value}
                    </p>
                  </div>

                  <div className={`p-3 rounded-xl ${card.bg}`}>
                    <card.icon size={22} />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* ALERTA ATRASADAS */}
      {!loading && isStudent && (
        <div className={`card p-5 mb-6 ${overdue.length ? 'border-red-300 bg-red-50' : ''}`}>
          {overdue.length ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={20} className="text-red-600 shrink-0" />

                <p className="font-bold text-red-700">
                  {overdue.length} {overdue.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
                </p>
              </div>

              <div className="space-y-2">
                {overdue.map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between items-center bg-white rounded-xl px-4 py-2.5 border border-red-100"
                  >
                    <p className="font-semibold text-sm text-slate-800">
                      {a.title}
                      <span className="muted font-normal ml-2">{a.subject_name}</span>
                    </p>

                    <span className="text-xs font-bold text-red-600 shrink-0">
                      {new Date(a.due_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                to="/trabalhos"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-red-600 hover:text-red-700"
              >
                Resolver agora <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />

              <p className="font-semibold text-emerald-700">Você não possui tarefas atrasadas.</p>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* PRÓXIMAS ENTREGAS */}
        <div className="lg:col-span-3 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xl font-bold">Próximas entregas</h3>

              <p className="muted mt-1">As 5 mais próximas, com urgência.</p>
            </div>

            <Link className="btn-secondary" to="/trabalhos">
              Ver todas <ArrowRight size={16} />
            </Link>
          </div>

          <div className="space-y-3">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}

            {!loading &&
              upcoming.map((a) => {
                const u = urgency(a.due_date);

                return (
                  <div key={a.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{a.title}</p>

                        <p className="muted mt-0.5 truncate">{a.subject_name}</p>

                        <p className="text-xs text-slate-400 mt-1">
                          Entrega: {new Date(a.due_date).toLocaleString('pt-BR')}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-black px-2.5 py-1.5 rounded-full tracking-wide shrink-0 ${u.chip}`}
                      >
                        {u.label}
                      </span>
                    </div>
                  </div>
                );
              })}

            {!loading && !upcoming.length && (
              <EmptyState
                icon={Clock}
                title="Nenhuma entrega próxima"
                text="Você está em dia. Aproveite!"
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* TAREFAS POR DISCIPLINA */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="text-blue-600" size={19} />

              <h3 className="font-bold">Tarefas por disciplina</h3>
            </div>

            <div className="space-y-2">
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}

              {!loading &&
                bySubject.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${subjectColor(s.name)}`}
                        >
                          {initials(s.name)}
                        </span>

                        <p className="font-semibold text-sm truncate">{s.name}</p>
                      </div>

                      <span className="text-sm font-black text-blue-600 shrink-0">
                        {s.count} {s.count === 1 ? 'tarefa' : 'tarefas'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${(s.count / Math.max(...bySubject.map((x) => x.count))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}

              {!loading && !bySubject.length && (
                <p className="muted text-center py-4">Nenhuma tarefa ainda.</p>
              )}
            </div>
          </div>

          {/* PROVAS PRÓXIMAS */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="text-violet-600" size={19} />

              <h3 className="font-bold">Próximas provas</h3>
            </div>

            <div className="space-y-2">
              {loading &&
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}

              {!loading &&
                provas.slice(0, 4).map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between items-center rounded-xl bg-violet-50 border border-violet-100 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">{e.title}</p>

                      <p className="text-xs text-slate-500">{e.subject_name || 'Geral'}</p>
                    </div>

                    <span className="text-xs font-bold text-violet-700 shrink-0">
                      {new Date(e.event_date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                ))}

              {!loading && !provas.length && (
                <p className="muted text-center py-4">Nenhuma prova marcada.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-slate-600 z-50">
          <Loader2 size={15} className="animate-spin" />
          Carregando...
        </div>
      )}
    </div>
  );
}
