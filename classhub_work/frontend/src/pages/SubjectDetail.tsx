import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  NotebookPen,
  UserRound,
} from 'lucide-react';
import { api, fileUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton, SkeletonCard } from '../components/Feedback';
import { eventTypeChip } from '../components/Calendar';
import { eventColor, initials, progressTone, subjectColor } from '../lib/colors';

export default function SubjectDetail() {
  const { user } = useAuth();
  const toast = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [subjectsRes, materialsRes, eventsRes, progressRes] = await Promise.all([
          api.get('/subjects'),
          api.get('/materials', { params: { subjectId: id } }),
          api.get('/events'),
          api.get('/progress'),
        ]);

        if (!mounted) return;

        const found = subjectsRes.data.find((item: any) => item.id === id);

        if (!found) {
          toast.error('Disciplina não encontrada.');
          return;
        }

        const now = new Date();

        setSubject(found);
        setMaterials(materialsRes.data);
        setEvents(
          eventsRes.data.filter(
            (event: any) => event.subject_id === id && new Date(event.event_date) >= now
          )
        );
        setProgress(Number(progressRes.data.find((item: any) => item.id === id)?.progress ?? 0));
      } catch (error) {
        console.error('Erro ao carregar disciplina:', error);
        toast.error('Não foi possível carregar a disciplina.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [id, toast]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-14 h-14" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <EmptyState
        icon={FileText}
        title="Disciplina não encontrada"
        text="Ela pode ter sido removida."
      >
        <Link className="btn-primary" to="/disciplinas">
          Voltar para disciplinas
        </Link>
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <Link
          to="/disciplinas"
          className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 mb-5"
        >
          <ArrowLeft size={16} />
          Voltar para disciplinas
        </Link>

        <div className="flex items-center gap-4">
          <span
            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${subjectColor(subject.name)}`}
          >
            {initials(subject.name)}
          </span>

          <div>
            <p className="text-blue-600 font-semibold text-sm">{subject.code || 'Disciplina'}</p>

            <h2 className="section-title">{subject.name}</h2>

            <p className="muted mt-1">
              Semestre {subject.semester} • Prof. {subject.professor_name || 'Não definido'}
            </p>
          </div>
        </div>

        {user?.role === 'ALUNO' && (
          <div className="card p-5 mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-slate-700">Progresso nos materiais</span>
              <b>{progress}%</b>
            </div>

            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressTone(progress)} rounded-full transition-all`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold">Materiais disponíveis</h3>
              <p className="muted mt-1">{materials.length} material(is)</p>
            </div>

            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <FileText size={20} />
            </div>
          </div>

          <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
            {materials.map((material) => (
              <div className="rounded-xl border border-slate-200 p-4" key={material.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="chip">{material.type}</span>

                  {material.completed && (
                    <span className="chip bg-emerald-100 text-emerald-700">Concluído</span>
                  )}
                </div>

                <p className="font-semibold mt-2">{material.title}</p>

                <p className="text-xs text-slate-400 mt-1">
                  Prof. {material.author_name || 'Não informado'} •{' '}
                  {new Date(material.created_at).toLocaleDateString('pt-BR')}
                </p>

                {material.url && (
                  <a
                    className="text-blue-600 text-sm font-semibold inline-block mt-2"
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir link →
                  </a>
                )}

                {material.file_path && (
                  <a
                    className="text-blue-600 text-sm font-semibold inline-block mt-2"
                    href={fileUrl(material.file_path)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir arquivo →
                  </a>
                )}
              </div>
            ))}

            {!materials.length && (
              <EmptyState
                icon={FileText}
                title="Nenhum material ainda"
                text="Os materiais desta disciplina aparecerão aqui."
              />
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold">Próximos eventos</h3>
              <p className="muted mt-1">{events.length} evento(s) futuro(s)</p>
            </div>

            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <CalendarDays size={20} />
            </div>
          </div>

          <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
            {events.map((event) => (
              <div
                className="rounded-xl border border-slate-200 p-4"
                key={event.id}
                style={{
                  borderLeft: `4px solid ${eventColor(event)}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`chip ${eventTypeChip(event.type)}`}>{event.type}</span>

                  <span className="text-xs text-slate-400">
                    {new Date(event.event_date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>

                <p className="font-semibold mt-2">{event.title}</p>

                {event.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                )}

                <p className="text-xs text-slate-400 mt-1">
                  {new Date(event.event_date).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}

            {!events.length && (
              <EmptyState
                icon={CalendarDays}
                title="Nenhum evento próximo"
                text="Provas e trabalhos desta disciplina aparecerão aqui."
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="card p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <UserRound size={26} />
          </div>

          <div>
            <h3 className="font-bold">Prof. {subject.professor_name || 'Não definido'}</h3>
            <p className="muted mt-1">Responsável pela disciplina</p>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold mb-4">Atalhos</h3>

          <div className="grid sm:grid-cols-3 gap-2">
            <Link to="/materiais" className="btn-secondary justify-center">
              <FileText size={16} />
              Materiais
            </Link>

            <Link to="/agenda" className="btn-secondary justify-center">
              <CalendarDays size={16} />
              Agenda
            </Link>

            <Link to="/notas" className="btn-secondary justify-center">
              <NotebookPen size={16} />
              Notas
            </Link>
          </div>

          <Link
            to="/trabalhos"
            className="text-blue-600 text-sm font-semibold inline-flex items-center gap-1 mt-4 hover:text-blue-700"
          >
            <ClipboardCheck size={15} />
            Ver trabalhos da disciplina
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
