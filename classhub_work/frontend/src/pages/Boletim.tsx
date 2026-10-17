import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Download, GraduationCap, PieChart, UsersRound } from 'lucide-react';
import { api, downloadCsv } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton, SkeletonCard } from '../components/Feedback';
import { initials, subjectColor } from '../lib/colors';

type StudentData = {
  role: 'ALUNO';
  overall: {
    avg: number | null;
    progressPct: number | null;
    pending: number;
    late: number;
  };
  subjects: {
    id: string;
    name: string;
    code: string | null;
    avg: number | null;
    progress: { done: number; total: number; pct: number | null };
    assignments: {
      id: string;
      title: string;
      dueDate: string;
      maxScore: number;
      score: number | null;
      status: 'GRADED' | 'SUBMITTED' | 'LATE' | 'PENDING';
    }[];
  }[];
};

type ProfessorData = {
  role: 'PROFESSOR';
  subjects: {
    id: string;
    name: string;
    code: string | null;
    assignments: number;
    pendingGrading: number;
  }[];
  students: {
    id: string;
    name: string;
    email: string;
    grades: Record<string, { submitted: number; graded: number; avg: number | null }>;
  }[];
};

function statusChip(status: string) {
  switch (status) {
    case 'GRADED':
      return { label: 'Corrigido', cls: 'bg-emerald-100 text-emerald-700' };
    case 'SUBMITTED':
      return { label: 'Enviado', cls: 'bg-violet-100 text-violet-700' };
    case 'LATE':
      return { label: 'Atrasado', cls: 'bg-red-100 text-red-700' };
    default:
      return { label: 'Pendente', cls: 'bg-slate-100 text-slate-600' };
  }
}

function ProgressRing({ pct, label }: { pct: number | null; label: string }) {
  const size = 92;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = pct === null ? 0 : Math.min(pct, 100);
  const offset = circumference - (value / 100) * circumference;
  const tone = pct === null ? '#cbd5e1' : pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          {pct === null ? (
            <span className="text-slate-300 text-xl font-bold">—</span>
          ) : (
            <span className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {pct}%
            </span>
          )}
        </div>
      </div>
      <div>
        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">materiais concluídos</p>
      </div>
    </div>
  );
}

export default function Boletim() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentData | ProfessorData | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/grades')
      .then((r) => {
        if (mounted) setData(r.data);
      })
      .catch(() => toast.error('Não foi possível carregar o boletim.'))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-7">
          <p className="text-violet-600 font-semibold">Desempenho</p>
          <h2 className="section-title mt-1">Boletim</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="mt-4 grid gap-4">
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.role === 'ALUNO') {
    const student = data as StudentData;
    const cards = [
      {
        label: 'Média geral',
        value: student.overall.avg !== null ? student.overall.avg.toFixed(1) : '—',
        icon: GraduationCap,
        bg: 'bg-violet-50 text-violet-600',
      },
      {
        label: 'Materiais concluídos',
        value: student.overall.progressPct !== null ? `${student.overall.progressPct}%` : '—',
        icon: CheckCircle2,
        bg: 'bg-violet-50 text-violet-600',
      },
      {
        label: 'Pendências',
        value: `${student.overall.pending + student.overall.late}`,
        icon: student.overall.late > 0 ? AlertTriangle : PieChart,
        bg: student.overall.late > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
      },
    ];

    return (
      <div>
        <div className="mb-7">
          <p className="text-violet-600 font-semibold">Desempenho</p>
          <h2 className="section-title mt-1">Boletim</h2>
          <p className="muted mt-2">
            Olá, {user?.name}. Aqui está o resumo do seu desempenho por disciplina.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="card p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${c.bg}`}>
                <c.icon size={22} />
              </div>
              <div>
                <div className="text-2xl font-black tabular-nums">{c.value}</div>
                <div className="text-xs font-semibold text-slate-500">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {student.subjects.length === 0 && (
          <div className="mt-4">
            <EmptyState
              icon={ClipboardList}
              title="Nada por aqui ainda"
              text="Quando houver disciplinas e trabalhos, seu boletim aparece aqui."
            />
          </div>
        )}

        <div className="mt-4 grid gap-4">
          {student.subjects.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${subjectColor(s.name)}`}
                  >
                    {initials(s.name)}
                  </div>
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.code || 'sem código'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-500">Média</div>
                  <div
                    className={`text-2xl font-black ${
                      s.avg === null
                        ? 'text-slate-300'
                        : s.avg >= 7
                          ? 'text-emerald-600'
                          : s.avg >= 5
                            ? 'text-amber-600'
                            : 'text-red-600'
                    }`}
                  >
                    {s.avg !== null ? s.avg.toFixed(1) : '—'}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <ProgressRing pct={s.progress.pct} label={`${s.progress.done} de ${s.progress.total}`} />
              </div>

              {s.assignments.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-500">
                        <th className="py-2 pr-4">Trabalho</th>
                        <th className="py-2 pr-4">Entrega</th>
                        <th className="py-2 pr-4">Nota</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.assignments.map((a) => {
                        const chip = statusChip(a.status);
                        return (
                          <tr key={a.id} className="border-t border-slate-100">
                            <td className="py-2 pr-4 font-medium">{a.title}</td>
                            <td className="py-2 pr-4 text-slate-500">
                              {new Date(a.dueDate).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-2 pr-4 font-semibold">
                              {a.score !== null ? `${a.score} / ${a.maxScore}` : '—'}
                            </td>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${chip.cls}`}>
                                {chip.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const prof = data as ProfessorData;

  return (
    <div>
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-violet-600 font-semibold">Desempenho</p>
          <h2 className="section-title mt-1">Boletim da turma</h2>
          <p className="muted mt-2">
            Médias (0–10) de cada aluno por disciplina. Células vazias indicam sem registro.
          </p>
        </div>
        <button
          className="btn-secondary shrink-0"
          onClick={async () => {
            try {
              await downloadCsv('/grades/export', 'boletim-classhub.csv');
              toast.success('CSV exportado.');
            } catch {
              toast.error('Não foi possível exportar o CSV.');
            }
          }}
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {prof.subjects.length === 0 || prof.students.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Sem dados para o boletim"
          text="Cadastre alunos, disciplinas e registre entregas para preencher a matriz."
        />
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-[#1b1b24]">
                <th className="p-4 sticky left-0 bg-slate-50 dark:bg-[#1b1b24]">Aluno</th>
                {prof.subjects.map((s) => (
                  <th key={s.id} className="p-4 whitespace-nowrap">
                    {s.name}
                    <div className="font-normal text-slate-400">
                      {s.assignments} trab. · {s.pendingGrading} p/ corrigir
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prof.students.map((st, i) => (
                <tr
                  key={st.id}
                  className={`border-t border-slate-100 dark:border-slate-800 ${
                    i % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-900/40' : ''
                  } hover:bg-violet-50/40 dark:hover:bg-violet-950/20 transition`}
                >
                  <td className="p-4 font-medium sticky left-0 bg-white dark:bg-[#14141a]">
                    {st.name}
                    <div className="text-xs text-slate-400">{st.email}</div>
                  </td>
                  {prof.subjects.map((s) => {
                    const g = st.grades[s.id] || { submitted: 0, graded: 0, avg: null };
                    return (
                      <td key={s.id} className="p-4">
                        <div
                          className={`font-bold tabular-nums ${
                            g.avg === null
                              ? 'text-slate-300'
                              : g.avg >= 7
                                ? 'text-emerald-600'
                                : g.avg >= 5
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                          }`}
                        >
                          {g.avg !== null ? g.avg.toFixed(1) : '—'}
                        </div>
                        <div className="text-xs text-slate-400 tabular-nums">
                          {g.submitted}/{s.assignments} entregas
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3">
        {prof.students.length} alunos · {prof.subjects.length} disciplinas ·{' '}
        {prof.subjects.reduce((acc, s) => acc + s.pendingGrading, 0)} entregas aguardando correção
      </p>
    </div>
  );
}
