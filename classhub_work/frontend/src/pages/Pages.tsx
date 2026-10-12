import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  Download,
  FileText,
  Plus,
  Send,
  Upload,
  Users,
  CalendarPlus,
  MessageCircle,
  ClipboardCheck,
  Clock,
  Loader2,
  Trash2,
  ArrowRight,
} from 'lucide-react';

import { api, fileUrl, downloadCsv } from '../lib/api';
import { useAuth } from '../lib/auth';
import { enableNotifications } from '../lib/pwa';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import Calendar, { dayKey, eventTypeChip } from '../components/Calendar';
import { EmptyState, Skeleton, SkeletonCard } from '../components/Feedback';
import { initials, subjectColor, EVENT_COLORS, eventColor } from '../lib/colors';

const NOTIF_TYPE_LABELS: Record<string, string> = {
  MATERIAL: 'Material',
  EVENT: 'Evento',
  NOTICE: 'Aviso',
  ASSIGNMENT: 'Trabalho',
  GRADE: 'Correção',
  FORUM: 'Fórum',
  INFO: 'Info',
};

/* =========================================================
   COMPONENTE BASE
========================================================= */

const Shell = ({
  title,
  desc,
  children,
  action,
}: {
  title: string;
  desc: string;
  children: any;
  action?: any;
}) => (
  <div>
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
      <div>
        <p className="text-blue-600 font-semibold">ClassHub</p>

        <h2 className="section-title mt-1">{title}</h2>

        <p className="muted mt-2">{desc}</p>
      </div>

      {action}
    </div>

    {children}
  </div>
);

/* =========================================================
   DISCIPLINAS
========================================================= */

export function Subjects() {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const loadSubjects = async () => {
    try {
      const response = await api.get('/subjects');
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar disciplinas:', error);
      toast.error('Não foi possível carregar as disciplinas.');
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchSubjects = async () => {
      try {
        const response = await api.get('/subjects');

        if (mounted) {
          setItems(response.data);
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
        if (mounted) {
          toast.error('Não foi possível carregar as disciplinas.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSubjects();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const addSubject = async () => {
    if (!name.trim()) return;

    setSending(true);

    try {
      await api.post('/subjects', {
        name,
        code,
      });

      setName('');
      setCode('');

      await loadSubjects();
      toast.success('Disciplina adicionada.');
    } catch (error) {
      console.error('Erro ao adicionar disciplina:', error);
      toast.error('Não foi possível adicionar a disciplina.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Shell title="Disciplinas" desc="Organize matérias, professores e conteúdos.">
      <div className="grid lg:grid-cols-3 gap-4">
        {loading && Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}

        {!loading &&
          items.map((subject) => (
            <Link to={`/disciplinas/${subject.id}`} className="card p-5 block" key={subject.id}>
              <div className="flex items-start justify-between">
                <span className="chip">{subject.code || 'SEM CÓDIGO'}</span>

                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${subjectColor(subject.name)}`}
                >
                  {initials(subject.name)}
                </span>
              </div>

              <h3 className="font-bold text-lg mt-3">{subject.name}</h3>

              <p className="muted mt-1">Prof. {subject.professor_name || 'Não definido'}</p>

              <p className="text-xs text-slate-400 mt-3">Semestre {subject.semester}</p>

              <span className="text-xs text-blue-600 font-semibold mt-3 flex items-center gap-1">
                Ver detalhes
                <ArrowRight size={13} />
              </span>
            </Link>
          ))}

        {!loading && !items.length && (
          <EmptyState
            title="Nenhuma disciplina ainda"
            text="Adicione a primeira matéria do semestre."
          />
        )}

        {user?.role === 'PROFESSOR' && (
          <div className="card p-5 border-dashed">
            <h3 className="font-bold mb-3">Nova disciplina</h3>

            <input
              className="input mb-2"
              placeholder="Nome da disciplina"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="input mb-3"
              placeholder="Código"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <button onClick={addSubject} className="btn-primary w-full" disabled={sending}>
              {sending ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Adicionar
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
/* =========================================================
   MATERIAIS
========================================================= */

export function Materials() {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [tag, setTag] = useState('');

  const [form, setForm] = useState({
    subjectId: '',
    title: '',
    description: '',
    type: 'PDF',
    url: '',
    tags: '',
    dueDate: '',
  });

  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);

    try {
      const response = await api.get('/materials', {
        params: {
          subjectId,
          tag,
        },
      });

      setItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Não foi possível carregar os materiais.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await api.get('/subjects');

        setSubjects(response.data);

        if (response.data[0]) {
          setForm((current) => ({
            ...current,
            subjectId: current.subjectId || response.data[0].id,
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
      }
    }

    loadSubjects();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao filtrar por disciplina/tag
  }, [subjectId, tag]);

  async function publish() {
    if (!form.subjectId) {
      toast.error('Selecione a disciplina do material.');
      return;
    }

    if (!form.title.trim()) {
      toast.error('Informe o título do material.');
      return;
    }

    setSending(true);

    try {
      const formData = new FormData();

      formData.append('subjectId', form.subjectId);

      Object.entries(form).forEach(([key, value]) => {
        if (key !== 'subjectId') {
          formData.append(key, value);
        }
      });

      if (file) {
        formData.append('file', file);
      }

      await api.post('/materials', formData);

      setForm((current) => ({
        ...current,
        title: '',
        description: '',
        type: 'PDF',
        url: '',
        tags: '',
        dueDate: '',
      }));

      setFile(null);

      await load();
      toast.success('Material publicado.');
    } catch (error) {
      console.error('Erro ao publicar material:', error);
      toast.error('Não foi possível publicar o material.');
    } finally {
      setSending(false);
    }
  }

  async function toggle(material: any) {
    try {
      await api.patch(`/materials/${material.id}/progress`, {
        completed: !material.completed,
      });

      await load();
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error);
      toast.error('Não foi possível atualizar o progresso.');
    }
  }

  return (
    <Shell title="Materiais" desc="Vídeos, PDFs, links e exercícios com tags, versões e progresso.">
      <div className="card p-4 mb-5 grid md:grid-cols-3 gap-3">
        <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Todas as disciplinas</option>

          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        <input
          className="input"
          placeholder="#prova ou #slides"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />

        <button
          className="btn-secondary"
          onClick={() => {
            setTag('');
            load();
          }}
        >
          Limpar filtros
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}

        {!loading &&
          items.map((material) => (
            <div className="card p-5" key={material.id}>
              <div className="flex justify-between gap-2">
                <span className="chip">{material.subject_name}</span>

                <span className="text-xs text-slate-400">v{material.version}</span>
              </div>

              <span className="chip mt-3 inline-flex bg-blue-50 text-blue-700">
                {material.type}
              </span>

              <h3 className="font-bold mt-2">{material.title}</h3>

              <p className="muted mt-1 line-clamp-3">{material.description}</p>

              <p className="text-xs text-slate-500 mt-3">
                Prof. {material.author_name || 'Não informado'}
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Publicado em {new Date(material.created_at).toLocaleString('pt-BR')}
              </p>

              <div className="flex flex-wrap gap-1 mt-3">
                {(material.tags || []).map((itemTag: string) => (
                  <span className="chip" key={itemTag}>
                    {itemTag}
                  </span>
                ))}
              </div>

              {material.url && (
                <a
                  className="text-blue-600 text-sm font-semibold inline-block mt-4"
                  href={material.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir link →
                </a>
              )}

              {material.file_path && (
                <a
                  className="text-blue-600 text-sm font-semibold inline-block mt-4"
                  href={fileUrl(material.file_path)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir arquivo →
                </a>
              )}

              {user?.role === 'ALUNO' && (
                <button
                  className={`w-full mt-4 ${material.completed ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => toggle(material)}
                >
                  {material.completed ? (
                    <>
                      <Check size={16} />
                      Concluído
                    </>
                  ) : (
                    <>Marcar como concluído</>
                  )}
                </button>
              )}
            </div>
          ))}

        {!loading && !items.length && (
          <EmptyState
            icon={FileText}
            title="Nenhum material encontrado"
            text="Publique o primeiro material ou ajuste os filtros."
          />
        )}

        {user?.role === 'PROFESSOR' && (
          <div className="card p-5 border-dashed md:col-span-2 lg:col-span-1">
            <h3 className="font-bold mb-3">Publicar material</h3>

            <select
              className="input mb-2"
              value={form.subjectId}
              onChange={(e) =>
                setForm({
                  ...form,
                  subjectId: e.target.value,
                })
              }
            >
              <option value="">Selecione a disciplina</option>

              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>

            <input
              className="input mb-2"
              placeholder="Título"
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
            />

            <textarea
              className="input mb-2"
              placeholder="Descrição"
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
            />

            <select
              className="input mb-2"
              value={form.type}
              onChange={(e) => {
                const next = e.target.value;
                setForm({
                  ...form,
                  type: next,
                  dueDate: next === 'EXERCICIO' || next === 'PROVA' ? form.dueDate : '',
                });
              }}
            >
              {['PDF', 'VIDEO', 'LINK', 'EXERCICIO', 'PROVA'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {(form.type === 'EXERCICIO' || form.type === 'PROVA') && (
              <input
                type="datetime-local"
                className="input mb-2"
                placeholder="Data de entrega"
                value={form.dueDate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dueDate: e.target.value,
                  })
                }
              />
            )}

            <input
              className="input mb-2"
              placeholder="URL (opcional)"
              value={form.url}
              onChange={(e) =>
                setForm({
                  ...form,
                  url: e.target.value,
                })
              }
            />

            <input
              className="input mb-2"
              placeholder="Tags separadas por vírgula"
              value={form.tags}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value,
                })
              }
            />

            <input
              type="file"
              className="input mb-3"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <button className="btn-primary w-full" onClick={publish} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Publicar
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 mt-2">Máximo: 50 MB.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

/* =========================================================
   NOTAS
========================================================= */

export function Notes() {
  const toast = useToast();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState('');
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await api.get('/subjects');

        setSubjects(response.data);

        if (response.data[0]) {
          setSubjectId(response.data[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
        toast.error('Não foi possível carregar as disciplinas.');
      }
    }

    loadSubjects();
  }, [toast]);

  useEffect(() => {
    if (!subjectId) return;

    let mounted = true;
    setHydratedFor(null);

    async function loadNote() {
      const local = localStorage.getItem(`classhub_note_${subjectId}`);

      if (local !== null) {
        setContent(local);

        if (mounted) {
          setHydratedFor(subjectId);
        }
      }

      try {
        const response = await api.get(`/notes/${subjectId}`);

        if (!mounted) return;

        if (local === null) {
          setContent(response.data.content || '');
          setHydratedFor(subjectId);
        }
      } catch (error) {
        console.error('Erro ao carregar nota:', error);
      }
    }

    loadNote();

    return () => {
      mounted = false;
    };
  }, [subjectId]);

  useEffect(() => {
    if (!subjectId || hydratedFor !== subjectId) {
      return;
    }

    localStorage.setItem(`classhub_note_${subjectId}`, content);

    const timer = setTimeout(() => {
      api
        .put(`/notes/${subjectId}`, {
          content,
        })
        .then(() => {
          setSaved('Salvo automaticamente');
        })
        .catch(() => {
          setSaved('Salvo localmente; aguardando conexão');
        });
    }, 800);

    return () => clearTimeout(timer);
  }, [content, subjectId, hydratedFor]);

  function pdf() {
    const windowPrint = window.open('', '_blank');

    if (!windowPrint) return;

    windowPrint.document.write(`
      <html>
        <head>
          <title>ClassHub - Notas</title>
        </head>

        <body style="font-family:Arial;padding:40px">
          <h1>ClassHub — Bloco de notas</h1>
          <p>
            ${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}
          </p>

          <script>
            window.print();
          </script>
        </body>
      </html>
    `);

    windowPrint.document.close();
  }

  return (
    <Shell
      title="Bloco de notas"
      desc="Notas pessoais por disciplina com salvamento automático local e na nuvem."
    >
      <div className="card p-5">
        <select
          className="input mb-4"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        <textarea
          className="input min-h-[480px]"
          placeholder="Digite suas anotações..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
          <span className="text-xs text-green-600">{saved || 'Sincronização ativada'}</span>

          <button className="btn-secondary" onClick={pdf}>
            <Download size={16} />
            Exportar / imprimir PDF
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* =========================================================
   AGENDA
========================================================= */

export function Agenda() {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => dayKey(new Date()));

  const [form, setForm] = useState({
    subjectId: '',
    title: '',
    description: '',
    eventDate: '',
    type: 'PROVA',
    color: '#2563eb',
    visibility: 'ALL',
    targetIds: [] as string[],
  });

  async function load() {
    try {
      const response = await api.get('/events');
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Não foi possível carregar os eventos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      await load();

      try {
        const response = await api.get('/subjects');

        setSubjects(response.data);

        if (response.data[0]) {
          setForm((current) => ({
            ...current,
            subjectId: response.data[0].id,
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
      }

      if (user?.role === 'PROFESSOR') {
        try {
          const response = await api.get('/users/students');

          setStudents(response.data);
        } catch (error) {
          console.error('Erro ao carregar alunos:', error);
        }
      }
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao montar
  }, []);

  async function add() {
    if (!form.title.trim()) {
      toast.error('Informe o título do evento.');
      return;
    }

    if (!form.eventDate) {
      toast.error('Informe a data do evento.');
      return;
    }

    if (user?.role === 'PROFESSOR' && form.visibility === 'SELECTED' && !form.targetIds.length) {
      toast.error('Selecione pelo menos um aluno.');
      return;
    }

    setSending(true);

    try {
      await api.post('/events', form);

      setForm((current) => ({
        ...current,
        title: '',
        description: '',
        eventDate: '',
        targetIds: [],
      }));

      await load();
      toast.success('Evento adicionado.');
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
      toast.error('Não foi possível adicionar o evento.');
    } finally {
      setSending(false);
    }
  }

  const dayEvents = items.filter((event) => dayKey(new Date(event.event_date)) === selectedDate);

  return (
    <Shell
      title="Agenda acadêmica"
      desc="Provas, prazos e eventos. Marcações de alunos são individuais; professores escolhem os destinatários."
    >
      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 card p-5">
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <Calendar events={items} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold mb-4 capitalize">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>

          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {loading &&
              Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}

            {!loading &&
              dayEvents.map((event) => (
                <div
                  className="rounded-xl border border-slate-200 p-4"
                  key={event.id}
                  style={{
                    borderLeft: `4px solid ${eventColor(event)}`,
                  }}
                >
                  <span className={`chip ${eventTypeChip(event.type)}`}>
                    {event.type} • {event.subject_name || 'Geral'}
                  </span>

                  <h4 className="font-bold mt-2">{event.title}</h4>

                  <p className="text-xs text-slate-500 mt-0.5">
                    por {event.author_name || 'Usuário'}
                  </p>

                  {event.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">{event.description}</p>
                  )}

                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(event.event_date).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}

            {!loading && !dayEvents.length && (
              <EmptyState
                icon={CalendarPlus}
                title="Nenhum evento neste dia"
                text="Selecione outro dia ou agende algo novo."
              />
            )}
          </div>
        </div>
      </div>

      <div className="card p-5 mt-5">
        <h3 className="font-bold mb-3">
          {user?.role === 'PROFESSOR' ? 'Novo evento' : 'Nova marcação'}
        </h3>

        <div className="grid md:grid-cols-2 gap-2">
          <select
            className="input"
            value={form.subjectId}
            onChange={(e) =>
              setForm({
                ...form,
                subjectId: e.target.value,
              })
            }
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={form.type}
            onChange={(e) =>
              setForm({
                ...form,
                type: e.target.value,
              })
            }
          >
            {['PROVA', 'TRABALHO', 'AULA', 'OUTRO'].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>

          <input
            className="input"
            placeholder="Título"
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
              })
            }
          />

          <input
            type="datetime-local"
            className="input"
            value={form.eventDate}
            onChange={(e) =>
              setForm({
                ...form,
                eventDate: e.target.value,
              })
            }
          />
        </div>
        <textarea
          className="input mt-2"
          placeholder="Descrição"
          value={form.description}
          onChange={(e) =>
            setForm({
              ...form,
              description: e.target.value,
            })
          }
        />

        {user?.role === 'PROFESSOR' ? (
          <select
            className="input mt-2"
            value={form.visibility}
            onChange={(e) =>
              setForm({
                ...form,
                visibility: e.target.value,
              })
            }
          >
            <option value="ALL">Marcar para toda a turma</option>

            <option value="SELECTED">Marcar para alunos selecionados</option>

            <option value="PRIVATE">Marcar individual (só para mim)</option>
          </select>
        ) : (
          <p className="text-xs text-slate-400 mt-2">
            Sua marcação é individual: só você a vê na agenda.
          </p>
        )}

        {user?.role === 'PROFESSOR' && form.visibility === 'SELECTED' && (
          <div className="mt-2 rounded-xl border border-slate-200 p-3 max-h-44 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 mb-2">Alunos destinatários</p>

            {students.map((student) => (
              <label key={student.id} className="flex items-center gap-2 text-sm py-1">
                <input
                  type="checkbox"
                  checked={form.targetIds.includes(student.id)}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      targetIds: e.target.checked
                        ? [...current.targetIds, student.id]
                        : current.targetIds.filter((x: string) => x !== student.id),
                    }))
                  }
                />

                {student.name}
              </label>
            ))}

            {!students.length && <p className="muted text-xs">Nenhum aluno cadastrado.</p>}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-sm font-medium text-slate-700">Cor da marcação:</span>

          {EVENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm({ ...form, color })}
              className={`w-7 h-7 rounded-full transition ${
                form.color === color
                  ? 'ring-2 ring-offset-2 ring-blue-600 scale-110'
                  : 'hover:scale-110'
              }`}
              style={{ background: color }}
              title={color}
            />
          ))}
        </div>

        <button className="btn-primary mt-4" onClick={add} disabled={sending}>
          {sending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Adicionando...
            </>
          ) : (
            <>
              <CalendarPlus size={16} />
              Adicionar evento
            </>
          )}
        </button>
      </div>
    </Shell>
  );
}

/* =========================================================
   TRABALHOS
========================================================= */

export function Assignments() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [grading, setGrading] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({
    score: '',
    feedback: '',
  });

  const [form, setForm] = useState({
    subjectId: '',
    title: '',
    description: '',
    dueDate: '',
    maxScore: '10',
  });

  async function load() {
    try {
      const response = await api.get('/assignments');
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar trabalhos:', error);
      toast.error('Não foi possível carregar os trabalhos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      await load();

      try {
        const response = await api.get('/subjects');

        setSubjects(response.data);

        if (response.data[0]) {
          setForm((current) => ({
            ...current,
            subjectId: response.data[0].id,
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
      }
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao montar
  }, []);

  async function submit(id: string, file: File) {
    const formData = new FormData();

    formData.append('file', file);

    try {
      await api.post(`/assignments/${id}/submit`, formData);

      toast.success('Trabalho enviado com sucesso.');

      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao enviar');
    }
  }

  async function create() {
    if (!form.title.trim() || !form.dueDate) {
      toast.error('Preencha título e data de entrega.');
      return;
    }

    setSending(true);

    try {
      await api.post('/assignments', form);

      setForm((current) => ({
        ...current,
        title: '',
        description: '',
        dueDate: '',
      }));

      await load();
      toast.success('Trabalho criado.');
    } catch (error) {
      console.error('Erro ao criar trabalho:', error);
      toast.error('Não foi possível criar o trabalho.');
    } finally {
      setSending(false);
    }
  }

  async function openSubs(assignment: any) {
    try {
      setSelected(assignment);

      const response = await api.get(`/assignments/${assignment.id}/submissions`);

      setSubs(response.data);
    } catch (error) {
      console.error('Erro ao carregar entregas:', error);
      toast.error('Não foi possível carregar as entregas.');
    }
  }

  async function grade(submission: any) {
    setGradeForm({
      score: submission.score ?? '',
      feedback: submission.feedback || '',
    });

    setGrading(submission);
  }

  async function submitGrade() {
    if (!grading) return;

    if (!selected) {
      setGrading(null);
      return;
    }

    if (gradeForm.score === '' || isNaN(Number(gradeForm.score))) {
      toast.error('Informe uma nota válida.');
      return;
    }

    try {
      await api.patch(`/assignments/submissions/${grading.id}`, {
        score: Number(gradeForm.score),
        feedback: gradeForm.feedback,
      });

      setGrading(null);

      await openSubs(selected);
      toast.success('Correção salva.');
    } catch (error) {
      console.error('Erro ao corrigir entrega:', error);
      toast.error('Não foi possível salvar a correção.');
    }
  }

  async function remove(id: string, title: string) {
    const ok = await confirm({
      title: `Excluir "${title}"?`,
      text: 'Entregas e o evento da agenda também serão removidos.',
      confirmLabel: 'Excluir',
      danger: true,
    });

    if (!ok) return;

    try {
      await api.delete(`/assignments/${id}`);

      if (selected?.id === id) {
        setSelected(null);
      }

      await load();
      toast.success('Trabalho excluído.');
    } catch (error) {
      console.error('Erro ao excluir trabalho:', error);
      toast.error('Não foi possível excluir o trabalho.');
    }
  }

  return (
    <Shell title="Trabalhos" desc="Entregas, correções, notas e feedback.">
      <div className="grid md:grid-cols-2 gap-4">
        {loading && Array.from({ length: 2 }).map((_, index) => <SkeletonCard key={index} />)}

        {!loading &&
          items.map((assignment) => (
            <div className="card p-5" key={assignment.id}>
              <span className="chip">{assignment.subject_name}</span>

              <h3 className="font-bold text-lg mt-3">{assignment.title}</h3>

              <p className="muted mt-2">{assignment.description}</p>

              <p className="text-sm mt-4">
                <b>Entrega:</b> {new Date(assignment.due_date).toLocaleString('pt-BR')}
              </p>

              {user?.role === 'ALUNO' && (
                <>
                  <p className="text-sm mt-2">
                    <b>Status:</b>{' '}
                    {assignment.submission_id ? (
                      <span className="text-green-600">Enviado</span>
                    ) : (
                      <span className="text-amber-600">Pendente</span>
                    )}
                  </p>

                  {assignment.score != null && (
                    <p className="text-sm mt-1">
                      <b>Nota:</b> {assignment.score}/{assignment.max_score}
                    </p>
                  )}

                  {assignment.feedback && (
                    <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm">
                      {assignment.feedback}
                    </div>
                  )}

                  <label className="btn-primary mt-4 cursor-pointer">
                    <Upload size={16} />
                    Enviar arquivo
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];

                        if (file) {
                          submit(assignment.id, file);
                        }
                      }}
                    />
                  </label>
                </>
              )}

              {user?.role === 'PROFESSOR' && (
                <>
                  <button className="btn-secondary mt-4" onClick={() => openSubs(assignment)}>
                    <ClipboardCheck size={16} />
                    Ver entregas
                  </button>

                  <button
                    className="btn-danger mt-4 ml-2"
                    onClick={() => remove(assignment.id, assignment.title)}
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </>
              )}
            </div>
          ))}

        {!loading && !items.length && (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhum trabalho"
            text="Não há entregas pendentes no momento."
          />
        )}
      </div>

      {user?.role === 'PROFESSOR' && (
        <div className="card p-5 mt-5">
          <h3 className="font-bold mb-3">Criar trabalho</h3>

          <div className="grid md:grid-cols-2 gap-2">
            <select
              className="input"
              value={form.subjectId}
              onChange={(e) =>
                setForm({
                  ...form,
                  subjectId: e.target.value,
                })
              }
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>

            <input
              className="input"
              placeholder="Título"
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
            />

            <input
              type="datetime-local"
              className="input"
              value={form.dueDate}
              onChange={(e) =>
                setForm({
                  ...form,
                  dueDate: e.target.value,
                })
              }
            />

            <input
              className="input"
              placeholder="Nota máxima"
              value={form.maxScore}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxScore: e.target.value,
                })
              }
            />
          </div>

          <textarea
            className="input mt-2"
            placeholder="Descrição"
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
          />

          <button className="btn-primary mt-3" onClick={create} disabled={sending}>
            {sending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus size={16} />
                Criar trabalho
              </>
            )}
          </button>
        </div>
      )}

      {selected && (
        <div className="card p-5 mt-5">
          <div className="flex justify-between">
            <h3 className="font-bold">Entregas — {selected.title}</h3>

            <button onClick={() => setSelected(null)} className="btn-secondary">
              Fechar
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {subs.map((submission) => (
              <div
                key={submission.id}
                className="rounded-xl border p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between"
              >
                <div>
                  <b>{submission.student_name}</b>

                  <p className="muted">
                    {submission.file_name} •{' '}
                    {new Date(submission.submitted_at).toLocaleString('pt-BR')}
                  </p>
                </div>

                <button className="btn-primary" onClick={() => grade(submission)}>
                  Corrigir
                </button>
              </div>
            ))}

            {!subs.length && <p className="muted">Nenhuma entrega.</p>}
          </div>
        </div>
      )}

      {grading && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/50 p-4">
          <div className="toast-in card p-6 w-full max-w-sm">
            <h3 className="font-bold">Corrigir entrega — {grading.student_name}</h3>

            <label className="label mt-4">Nota</label>
            <input
              className="input"
              type="number"
              step="0.1"
              value={gradeForm.score}
              onChange={(e) =>
                setGradeForm({
                  ...gradeForm,
                  score: e.target.value,
                })
              }
            />

            <label className="label mt-3">Feedback</label>
            <textarea
              className="input"
              value={gradeForm.feedback}
              onChange={(e) =>
                setGradeForm({
                  ...gradeForm,
                  feedback: e.target.value,
                })
              }
            />

            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-secondary" onClick={() => setGrading(null)}>
                Cancelar
              </button>

              <button className="btn-primary" onClick={submitGrade}>
                Salvar correção
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* =========================================================
   FÓRUM
========================================================= */

export function Forum() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<Record<string, string>>({});

  async function load() {
    try {
      const response = await api.get('/forum');
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar fórum:', error);
      toast.error('Não foi possível carregar o fórum.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      await load();

      try {
        const response = await api.get('/materials');

        setMaterials(response.data);

        if (response.data[0]) {
          setMaterialId(response.data[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar materiais:', error);
      }
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao montar
  }, []);

  async function ask() {
    if (!question.trim()) return;

    if (!materialId) {
      toast.error('Selecione um material.');
      return;
    }

    setSending(true);

    try {
      await api.post('/forum', {
        materialId,
        question,
      });

      setQuestion('');

      await load();
      toast.success('Dúvida publicada.');
    } catch (error) {
      console.error('Erro ao publicar dúvida:', error);
      toast.error('Não foi possível publicar a dúvida.');
    } finally {
      setSending(false);
    }
  }

  async function answer(id: string) {
    if (!reply[id]?.trim()) return;

    setSendingReply(id);

    try {
      await api.post(`/forum/${id}/replies`, {
        content: reply[id],
      });

      setReply({
        ...reply,
        [id]: '',
      });

      await load();
    } catch (error) {
      console.error('Erro ao responder:', error);
      toast.error('Não foi possível enviar a resposta.');
    } finally {
      setSendingReply(null);
    }
  }

  return (
    <Shell
      title="Fórum de dúvidas"
      desc="Perguntas por material com respostas oficiais dos professores."
    >
      <div className="card p-5 mb-5">
        <select
          className="input mb-3"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
        >
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.title}
            </option>
          ))}
        </select>

        <textarea
          className="input mb-3"
          placeholder="Digite sua dúvida..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button onClick={ask} className="btn-primary" disabled={sending}>
          {sending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Send size={16} />
              Publicar dúvida
            </>
          )}
        </button>
      </div>

      <div className="space-y-3">
        {loading &&
          Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}

        {!loading &&
          items.map((item) => (
            <div className="card p-5" key={item.id}>
              <p className="text-xs text-blue-600 font-bold">
                {item.material_title} • {item.author_name || 'Usuário'}
              </p>

              <h3 className="font-bold mt-2">{item.question}</h3>

              <div className="mt-4 space-y-2">
                {(item.replies || []).map((response: any) => (
                  <div
                    key={response.id}
                    className={`rounded-xl p-3 ${
                      response.official ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'
                    }`}
                  >
                    <p className="text-sm">{response.content}</p>

                    <p className="text-xs text-slate-400 mt-1">
                      {response.author_name} {response.official && '• Resposta oficial'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  className="input"
                  placeholder="Responder"
                  value={reply[item.id] || ''}
                  onChange={(e) =>
                    setReply({
                      ...reply,
                      [item.id]: e.target.value,
                    })
                  }
                />

                <button
                  className="btn-primary"
                  onClick={() => answer(item.id)}
                  disabled={sendingReply === item.id}
                >
                  {sendingReply === item.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}

        {!loading && !items.length && (
          <EmptyState
            icon={MessageCircle}
            title="Nenhuma dúvida ainda"
            text="Seja o primeiro a perguntar sobre um material."
          />
        )}
      </div>
    </Shell>
  );
}

/* =========================================================
   PRESENÇA
========================================================= */

export function Attendance() {
  const { user } = useAuth();
  const toast = useToast();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectId, setSubjectId] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState<any>(null);
  const [mine, setMine] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  async function loadSessions() {
    try {
      const response = await api.get('/attendance/sessions');

      setSessions(response.data);
    } catch (error) {
      console.error('Erro ao carregar chamadas:', error);
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        const subjectResponse = await api.get('/subjects');

        setSubjects(subjectResponse.data);

        if (subjectResponse.data[0]) {
          setSubjectId(subjectResponse.data[0].id);
        }

        if (user?.role === 'ALUNO') {
          const response = await api.get('/attendance/mine');

          setMine(response.data);
        } else {
          await loadSessions();
        }
      } catch (error) {
        console.error('Erro ao carregar presença:', error);
        toast.error('Não foi possível carregar a presença.');
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [user?.role, toast]);

  async function open() {
    try {
      const response = await api.post('/attendance/open', {
        subjectId,
        minutes: Number(minutes),
      });

      setActive(response.data);
      await loadSessions();
      toast.success('Chamada aberta.');
    } catch (error) {
      console.error('Erro ao abrir chamada:', error);
      toast.error('Não foi possível abrir a chamada.');
    }
  }

  async function closeSession(session: any) {
    try {
      await api.patch(`/attendance/sessions/${session.id}/close`);

      if (active?.id === session.id) {
        setActive(null);
      }

      await loadSessions();
      toast.success('Chamada encerrada.');
    } catch (error: any) {
      console.error('Erro ao encerrar chamada:', error);
      toast.error(error.response?.data?.message || 'Não foi possível encerrar a chamada.');
    }
  }

  async function mark() {
    try {
      await api.post('/attendance/mark', { pin });

      setPin('');
      toast.success('Presença registrada!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro');
    }
  }

  return (
    <Shell title="Presença" desc="Chamada por PIN temporário e histórico de presença.">
      {user?.role === 'PROFESSOR' ? (
        <>
          <div className="card p-5">
            <div className="grid md:grid-cols-4 gap-2">
              <select
                className="input"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>

              <input
                className="input"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Minutos"
              />

              <button className="btn-primary" onClick={open}>
                <Clock size={16} />
                Abrir chamada
              </button>

              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    await downloadCsv('/attendance/export', 'presencas-classhub.csv');
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

            {active && (
              <div className="mt-5 rounded-2xl bg-blue-50 p-6 text-center">
                <p className="text-sm text-blue-700">PIN da chamada</p>

                <p className="text-5xl font-black tracking-[.25em] text-blue-700 mt-2">
                  {active.pin}
                </p>

                <p className="text-sm text-slate-500 mt-2">
                  Expira às {new Date(active.expires_at).toLocaleTimeString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2">
            {loading &&
              Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}

            {!loading &&
              sessions.map((session) => (
                <div className="card p-4 flex justify-between items-center" key={session.id}>
                  <div>
                    <b>{session.subject_name}</b>

                    <p className="muted">
                      PIN {session.pin} • {new Date(session.expires_at).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="chip">{session.present_count} presentes</span>

                    {new Date(session.expires_at) > new Date() && (
                      <button
                        className="btn-danger text-sm px-3 py-2"
                        onClick={() => closeSession(session)}
                      >
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>
              ))}

            {!loading && !sessions.length && (
              <EmptyState
                icon={Clock}
                title="Nenhuma chamada registrada"
                text="Abra uma chamada para registrar presenças."
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card p-6 text-center">
            <Users className="mx-auto text-blue-600" />

            <h3 className="font-bold text-xl mt-3">Digite o PIN</h3>

            <p className="muted mt-1">Peça o código ao professor.</p>

            <input
              className="input max-w-xs mx-auto mt-4 text-center text-2xl tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />

            <button className="btn-primary mt-3" onClick={mark}>
              Registrar presença
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {loading &&
              Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}

            {!loading &&
              mine.map((item) => (
                <div className="card p-4 flex justify-between" key={item.id}>
                  <div>
                    <b>{item.subject_name}</b>

                    <p className="muted">{new Date(item.marked_at).toLocaleString('pt-BR')}</p>
                  </div>

                  <span className="text-green-600 font-semibold">Presente</span>
                </div>
              ))}

            {!loading && !mine.length && (
              <EmptyState
                icon={Users}
                title="Nenhuma presença ainda"
                text="Digite o PIN informado pelo professor para registrar sua presença."
              />
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

/* =========================================================
   SALAS DE ESTUDO
========================================================= */

export function Rooms() {
  const toast = useToast();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');

  const [form, setForm] = useState({
    subjectId: '',
    name: '',
    description: '',
  });

  async function load() {
    try {
      const response = await api.get('/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error('Erro ao carregar salas:', error);
      toast.error('Não foi possível carregar as salas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      await load();

      try {
        const response = await api.get('/subjects');

        setSubjects(response.data);

        if (response.data[0]) {
          setForm((current) => ({
            ...current,
            subjectId: response.data[0].id,
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
      }
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao montar
  }, []);

  async function open(room: any) {
    try {
      setSelected(room);

      const response = await api.get(`/rooms/${room.id}/posts`);

      setPosts(response.data);
    } catch (error) {
      console.error('Erro ao abrir sala:', error);
      toast.error('Não foi possível abrir a sala.');
    }
  }

  async function create() {
    if (!form.name.trim()) {
      toast.error('Informe o nome da sala.');
      return;
    }

    if (!form.subjectId) {
      toast.error('Selecione uma disciplina (crie uma disciplina primeiro).');
      return;
    }

    setSending(true);

    try {
      await api.post('/rooms', form);

      setForm({
        ...form,
        name: '',
        description: '',
      });

      await load();
      toast.success('Sala criada.');
    } catch (error) {
      console.error('Erro ao criar sala:', error);
      toast.error('Não foi possível criar a sala.');
    } finally {
      setSending(false);
    }
  }

  async function post() {
    if (!content.trim() || !selected) {
      return;
    }

    try {
      await api.post(`/rooms/${selected.id}/posts`, { content });

      setContent('');

      await open(selected);
    } catch (error) {
      console.error('Erro ao publicar:', error);
      toast.error('Não foi possível publicar.');
    }
  }

  return (
    <Shell
      title="Salas de estudo"
      desc="Espaços colaborativos para trocar anotações e links úteis."
    >
      <div className="grid lg:grid-cols-3 gap-4">
        {loading && Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}

        {!loading &&
          rooms.map((room) => (
            <button
              onClick={() => open(room)}
              className="card p-5 text-left hover:border-blue-400"
              key={room.id}
            >
              <span className="chip">{room.subject_name}</span>

              <h3 className="font-bold mt-3">{room.name}</h3>

              <p className="muted mt-1">{room.description}</p>

              <p className="text-xs text-slate-400 mt-3">{room.post_count} publicações</p>
            </button>
          ))}

        <div className="card p-5 border-dashed">
          <h3 className="font-bold mb-3">Nova sala</h3>

          <select
            className="input mb-2"
            value={form.subjectId}
            onChange={(e) =>
              setForm({
                ...form,
                subjectId: e.target.value,
              })
            }
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>

          <input
            className="input mb-2"
            placeholder="Nome"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
          />

          <textarea
            className="input mt-2"
            placeholder="Descrição"
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
          />

          <button className="btn-primary w-full" onClick={create} disabled={sending}>
            {sending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus size={16} />
                Criar sala
              </>
            )}
          </button>
        </div>
      </div>

      {selected && (
        <div className="card p-5 mt-5">
          <div className="flex justify-between">
            <div>
              <h3 className="font-bold text-xl">{selected.name}</h3>

              <p className="muted">{selected.description}</p>
            </div>

            <button className="btn-secondary" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {posts.map((post) => (
              <div className="rounded-xl bg-slate-50 p-4" key={post.id}>
                <b className="text-sm">{post.author_name}</b>

                <p className="mt-1">{post.content}</p>

                <p className="text-xs text-slate-400 mt-1">
                  {new Date(post.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <input
              className="input"
              placeholder="Compartilhe algo..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <button className="btn-primary" onClick={post}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* =========================================================
   NOTIFICAÇÕES
========================================================= */

export function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserOn, setBrowserOn] = useState(
    () => 'Notification' in window && Notification.permission === 'granted'
  );
  const itemsRef = useRef<any[]>([]);

  function shownStorageKey() {
    return `classhub_shown_notifs_${user?.id || 'anon'}`;
  }

  function readShownIds() {
    try {
      const raw = localStorage.getItem(shownStorageKey());

      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? new Set<string>(parsed) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  function persistShownIds(ids: Set<string>) {
    try {
      localStorage.setItem(shownStorageKey(), JSON.stringify(Array.from(ids).slice(-200)));
    } catch {}
  }

  async function load() {
    try {
      const response = await api.get('/notifications');

      const oldIds = new Set(itemsRef.current.map((item: any) => item.id));

      if (browserOn && 'Notification' in window && Notification.permission === 'granted') {
        const shownIds = readShownIds();

        const fresh = response.data
          .filter((item: any) => !oldIds.has(item.id) && !item.read_at && !shownIds.has(item.id))
          .slice(0, 3);

        fresh.forEach((notification: any) => {
          shownIds.add(notification.id);

          new Notification(notification.title, {
            body: notification.body,
          });
        });

        if (fresh.length) {
          persistShownIds(shownIds);
        }
      }

      itemsRef.current = response.data;
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toast.error('Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const timer = setInterval(load, 10000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling controlado por browserOn
  }, [browserOn]);

  async function read(id: string) {
    await api.patch(`/notifications/${id}/read`);

    await load();
  }

  async function all() {
    await api.patch('/notifications/read-all');

    await load();
  }

  async function remove(id: string) {
    try {
      await api.delete(`/notifications/${id}`);

      await load();
      toast.success('Notificação apagada.');
    } catch (error) {
      console.error('Erro ao apagar notificação:', error);
      toast.error('Não foi possível apagar a notificação.');
    }
  }

  async function removeAll() {
    const ok = await confirm({
      title: 'Apagar todas as notificações?',
      text: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Apagar todas',
      danger: true,
    });

    if (!ok) return;

    try {
      await api.delete('/notifications');

      await load();
      toast.success('Todas as notificações foram apagadas.');
    } catch (error) {
      console.error('Erro ao apagar notificações:', error);
      toast.error('Não foi possível apagar as notificações.');
    }
  }

  async function enable() {
    try {
      await enableNotifications();

      setBrowserOn(true);

      toast.success('Notificações do navegador ativadas.');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  return (
    <Shell
      title="Notificações"
      desc="Avisos de materiais, prazos, fórum e correções."
      action={
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={enable}>
            <Bell size={16} />
            Ativar navegador
          </button>

          <button className="btn-secondary" onClick={all}>
            Marcar todas lidas
          </button>

          <button className="btn-danger" onClick={removeAll}>
            <Trash2 size={16} />
            Apagar todas
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}

        {!loading &&
          items.map((notification) => (
            <div
              key={notification.id}
              onClick={() => read(notification.id)}
              className={`w-full text-left card p-4 cursor-pointer ${
                !notification.read_at ? 'border-blue-300 bg-blue-50/40' : ''
              }`}
            >
              <div className="flex gap-3">
                <Bell className="text-blue-600 mt-1" size={18} />

                <div className="flex-1">
                  <div className="flex justify-between gap-2">
                    <b>{notification.title}</b>

                    <span className="flex gap-1 shrink-0">
                      <span className="chip">
                        {NOTIF_TYPE_LABELS[notification.type] || notification.type}
                      </span>

                      {!notification.read_at && <span className="chip">Nova</span>}
                    </span>
                  </div>

                  <p className="muted mt-1">{notification.body}</p>

                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(notification.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(notification.id);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  title="Apagar notificação"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}

        {!loading && !items.length && (
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação"
            text="Você está em dia com os avisos."
          />
        )}
      </div>
    </Shell>
  );
}

/* =========================================================
   PAINEL DO PROFESSOR
========================================================= */

export function ProfessorPanel() {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [notice, setNotice] = useState({
    subjectId: '',
    title: '',
    content: '',
    pinned: false,
  });

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await api.get('/subjects');

        setSubjects(response.data);

        if (response.data[0]) {
          setNotice((current) => ({
            ...current,
            subjectId: response.data[0].id,
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
        toast.error('Não foi possível carregar as disciplinas.');
      }
    }

    loadSubjects();
  }, [toast]);

  async function publish() {
    if (!notice.title.trim() || !notice.content.trim()) {
      toast.error('Preencha título e comunicado.');
      return;
    }

    setSending(true);

    try {
      await api.post('/notices', notice);

      setNotice((current) => ({
        ...current,
        title: '',
        content: '',
      }));

      toast.success('Aviso publicado e notificação enviada.');
    } catch (error) {
      console.error('Erro ao publicar aviso:', error);
      toast.error('Não foi possível publicar o aviso.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell title="Painel do professor" desc="Centralize as principais ações de gestão da turma.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <a className="card p-5 hover:border-blue-400" href="/materiais">
          <FileText className="text-blue-600" />

          <b className="block mt-3">Publicar material</b>

          <span className="muted">PDF, vídeo, link e exercício.</span>
        </a>

        <a className="card p-5 hover:border-blue-400" href="/trabalhos">
          <ClipboardCheck className="text-blue-600" />

          <b className="block mt-3">Gerenciar trabalhos</b>

          <span className="muted">Criar, corrigir e dar feedback.</span>
        </a>

        <a className="card p-5 hover:border-blue-400" href="/presenca">
          <Users className="text-blue-600" />

          <b className="block mt-3">Abrir chamada</b>

          <span className="muted">PIN temporário.</span>
        </a>
      </div>

      <div className="card p-5 mt-5">
        <h3 className="font-bold mb-3">Publicar aviso</h3>

        <select
          className="input mb-2"
          value={notice.subjectId}
          onChange={(e) =>
            setNotice({
              ...notice,
              subjectId: e.target.value,
            })
          }
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        <input
          className="input mb-2"
          placeholder="Título"
          value={notice.title}
          onChange={(e) =>
            setNotice({
              ...notice,
              title: e.target.value,
            })
          }
        />

        <textarea
          className="input mb-2"
          placeholder="Comunicado"
          value={notice.content}
          onChange={(e) =>
            setNotice({
              ...notice,
              content: e.target.value,
            })
          }
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notice.pinned}
            onChange={(e) =>
              setNotice({
                ...notice,
                pinned: e.target.checked,
              })
            }
          />
          Fixar aviso
        </label>

        <button className="btn-primary mt-3" onClick={publish} disabled={sending}>
          {sending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Bell size={16} />
              Publicar aviso
            </>
          )}
        </button>
      </div>
    </Shell>
  );
}
