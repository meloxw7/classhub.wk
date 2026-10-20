import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  Layers,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton } from '../components/Feedback';

type Flashcard = {
  id: string;
  front: string;
  back: string;
  box: number;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  subjectId: string | null;
  subjectName: string | null;
  materialId: string | null;
  materialTitle: string | null;
};

type Stats = {
  total: number;
  due: number;
  boxes: Record<'1' | '2' | '3' | '4' | '5', number>;
  bySubject: { id: string; name: string; total: number; due: number }[];
};

const EMPTY_FORM = { front: '', back: '', subjectId: '', materialId: '' };

export default function Flashcards() {
  const toast = useToast();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ id: string; title: string; subject_id: string }[]>([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const [reviewing, setReviewing] = useState(false);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewingCard, setReviewingCard] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api.get('/flashcards', { params: filter ? { subjectId: filter } : {} }),
        api.get('/flashcards/stats'),
      ]);
      setCards(c.data);
      setStats(s.data);
    } catch {
      setCards([]);
      toast.error('Não foi possível carregar os flashcards.');
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!subjects.length) {
      api
        .get('/subjects')
        .then((r) => setSubjects(r.data))
        .catch(() => {});
      api
        .get('/materials')
        .then((r) => setMaterials(r.data))
        .catch(() => {});
    }
  }, [subjects.length]);

  async function save() {
    const front = form.front.trim();
    const back = form.back.trim();
    if (!front || !back) {
      toast.error('Preencha a frente e o verso.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/flashcards/${editing}`, { front, back });
        toast.success('Cartão atualizado.');
      } else {
        await api.post('/flashcards', {
          front,
          back,
          subjectId: form.subjectId || undefined,
          materialId: form.materialId || undefined,
        });
        toast.success('Cartão criado!');
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível salvar o cartão.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir este cartão?')) return;
    try {
      await api.delete(`/flashcards/${id}`);
      setCards((current) => (current || []).filter((c) => c.id !== id));
      load();
    } catch {
      toast.error('Não foi possível excluir.');
    }
  }

  function startEdit(card: Flashcard) {
    setEditing(card.id);
    setForm({
      front: card.front,
      back: card.back,
      subjectId: card.subjectId || '',
      materialId: card.materialId || '',
    });
  }

  async function startReview() {
    setLoadingQueue(true);
    setReviewing(true);
    setQueueIndex(0);
    setFlipped(false);
    try {
      const r = await api.get('/flashcards/due', { params: filter ? { subjectId: filter } : {} });
      setQueue(r.data);
      if (!r.data.length) toast.info('Nenhum cartão vencido. Volte mais tarde!');
    } catch {
      toast.error('Não foi possível carregar a fila.');
      setReviewing(false);
    } finally {
      setLoadingQueue(false);
    }
  }

  async function review(result: 'GOOD' | 'AGAIN') {
    const card = queue[queueIndex];
    if (!card) return;
    setReviewingCard(true);
    try {
      const r = await api.post(`/flashcards/${card.id}/review`, { result });
      const updated = r.data as Flashcard;
      setCards((current) =>
        (current || []).map((c) => (c.id === updated.id ? { ...c, box: updated.box, dueAt: updated.dueAt } : c))
      );
      if (result === 'GOOD') toast.success(`Acertou! Caixa ${updated.box}.`);
      else toast.info('Volta pra caixa 1 — revisa em 10 min.');
      setFlipped(false);
      setQueueIndex((i) => i + 1);
      const s = await api.get('/flashcards/stats');
      setStats(s.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao registrar revisão.');
    } finally {
      setReviewingCard(false);
    }
  }

  const currentCard = queue[queueIndex];
  const filteredMaterials = form.subjectId
    ? materials.filter((m) => m.subject_id === form.subjectId)
    : materials;

  return (
    <div>
      <div className="mb-7">
        <p className="text-violet-600 font-semibold">Ferramentas</p>
        <h2 className="section-title mt-1">Flashcards</h2>
        <p className="muted mt-2">
          Revisão espaçada Leitner: acertou, sobe de caixa e espaça mais. Errou, volta pra caixa 1.
        </p>
      </div>

      {reviewing ? (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setReviewing(false)}
              className="btn-secondary !py-2"
            >
              <X size={15} /> Sair da revisão
            </button>
            <span className="chip">
              {Math.min(queueIndex + (currentCard ? 1 : 0), queue.length)} de {queue.length}
            </span>
          </div>

          {loadingQueue && (
            <div className="card p-8 text-center">
              <Loader2 className="animate-spin mx-auto text-violet-600" />
              <p className="muted mt-2">Carregando fila…</p>
            </div>
          )}

          {!loadingQueue && !currentCard && queue.length === 0 && (
            <EmptyState
              icon={ListChecks}
              title="Nenhum cartão vencido"
              text="Tudo revisado por aqui. Volte quando os cartões vencerem."
            >
              <button onClick={() => setReviewing(false)} className="btn-primary">
                Voltar aos cartões
              </button>
            </EmptyState>
          )}

          {!loadingQueue && !currentCard && queue.length > 0 && (
            <EmptyState
              icon={Check}
              title="Revisão concluída!"
              text={`${queue.length} cart${queue.length === 1 ? 'ão' : 'ões'} revisado${queue.length === 1 ? '' : 's'} nesta sessão.`}
            >
              <button onClick={() => setReviewing(false)} className="btn-primary">
                Voltar aos cartões
              </button>
            </EmptyState>
          )}

          {!loadingQueue && currentCard && (
            <div className="page-in">
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-4 overflow-hidden">
                <div
                  className="h-full bg-violet-600 rounded-full transition-all duration-500"
                  style={{ width: `${(queueIndex / queue.length) * 100}%` }}
                />
              </div>
              <button
                onClick={() => setFlipped((f) => !f)}
                className="card w-full p-10 text-center min-h-[16rem] flex flex-col items-center justify-center hover:border-violet-300 dark:hover:border-violet-700 transition"
              >
                <span className="eyebrow mb-3">
                  {flipped ? 'Verso' : 'Frente'} · caixa {currentCard.box}
                </span>
                <p className="text-lg font-semibold whitespace-pre-wrap break-words max-w-xl">
                  {flipped ? currentCard.back : currentCard.front}
                </p>
                <span className="muted text-xs mt-6 flex items-center gap-1">
                  {flipped ? <EyeOff size={13} /> : <Eye size={13} />}
                  clique para {flipped ? 'ver a frente' : 'virar o cartão'}
                </span>
              </button>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => review('AGAIN')}
                  disabled={reviewingCard}
                  className="btn-secondary !border-red-200 !text-red-600 hover:!bg-red-50 dark:!border-red-900 dark:hover:!bg-red-950/40 rounded-xl"
                >
                  {reviewingCard ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  Errei
                </button>
                <button onClick={() => review('GOOD')} disabled={reviewingCard} className="btn-primary">
                  {reviewingCard ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Acertei
                </button>
              </div>
              {currentCard.subjectName && (
                <p className="muted text-xs text-center mt-3">{currentCard.subjectName}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{editing ? 'Editar cartão' : 'Novo cartão'}</h3>
                {editing && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setForm(EMPTY_FORM);
                    }}
                    className="chip"
                  >
                    cancelar edição
                  </button>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <select
                  className="input"
                  value={form.subjectId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subjectId: e.target.value, materialId: '' }))
                  }
                >
                  <option value="">Sem disciplina</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={form.materialId}
                  onChange={(e) => setForm((f) => ({ ...f, materialId: e.target.value }))}
                >
                  <option value="">Sem material</option>
                  {filteredMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="input mb-3"
                placeholder="Frente — a pergunta ou conceito"
                maxLength={500}
                value={form.front}
                onChange={(e) => setForm((f) => ({ ...f, front: e.target.value }))}
              />
              <textarea
                className="input resize-none mb-3"
                placeholder="Verso — a resposta"
                rows={3}
                maxLength={500}
                value={form.back}
                onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))}
              />
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editing ? (
                  <>
                    <Pencil size={16} /> Salvar alterações
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Criar cartão
                  </>
                )}
              </button>
            </div>

            {cards === null ? (
              <div className="card p-5">
                <Skeleton className="h-20 w-full" />
              </div>
            ) : cards.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Nenhum flashcard ainda"
                text="Crie seu primeiro cartão acima — dica: comece pelos conceitos que sempre caem na prova."
              />
            ) : (
              <div className="space-y-3">
                {cards.map((card) => (
                  <div key={card.id} className="card p-4 fade-slide-in">
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 grid place-items-center font-bold text-sm shrink-0">
                        {card.box}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm break-words">{card.front}</p>
                        {revealed[card.id] ? (
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words whitespace-pre-wrap">
                            {card.back}
                          </p>
                        ) : (
                          <button
                            onClick={() => setRevealed((r) => ({ ...r, [card.id]: true }))}
                            className="text-xs text-violet-600 font-semibold hover:underline mt-1 flex items-center gap-1"
                          >
                            <Eye size={12} /> ver verso
                          </button>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {card.subjectName && <span className="chip">{card.subjectName}</span>}
                          {card.materialTitle && (
                            <span className="chip truncate max-w-[180px]">{card.materialTitle}</span>
                          )}
                          <span
                            className={`text-xs flex items-center gap-1 ${
                              new Date(card.dueAt) <= new Date()
                                ? 'text-amber-600 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            <Clock size={12} />
                            {new Date(card.dueAt) <= new Date()
                              ? 'vencido — revise!'
                              : new Date(card.dueAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(card)}
                          title="Editar"
                          className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(card.id)}
                          title="Excluir"
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <RefreshCw size={16} className="text-violet-600" /> Revisão
              </h3>
              <p className="muted text-sm mb-3">
                {stats?.due ? (
                  <>
                    <strong className="text-amber-600">{stats.due}</strong> cart
                    {stats.due === 1 ? 'ão vencido' : 'ões vencidos'} agora.
                  </>
                ) : (
                  'Nenhum cartão vencido no momento.'
                )}
              </p>
              <select
                className="input mb-3"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Todas as disciplinas</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button onClick={startReview} disabled={loadingQueue} className="btn-primary w-full">
                {loadingQueue ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ListChecks size={16} />
                )}
                Revisar agora
              </button>
            </div>

            {stats && stats.total > 0 && (
              <div className="card p-5">
                <h3 className="font-bold mb-3">Suas caixas</h3>
                <div className="space-y-2">
                  {(['1', '2', '3', '4', '5'] as const).map((box) => {
                    const n = stats.boxes[box];
                    const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
                    return (
                      <div key={box} className="flex items-center gap-3 text-xs">
                        <span className="w-12 text-slate-400 font-semibold">caixa {box}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-violet-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-semibold">{n}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="muted text-xs mt-3">
                  Total: <strong>{stats.total}</strong> cartões · caixas altas = revisões mais espaçadas
                </p>
              </div>
            )}

            {stats && stats.bySubject.length > 0 && (
              <div className="card p-5">
                <h3 className="font-bold mb-3">Por disciplina</h3>
                <ul className="space-y-2 text-sm">
                  {stats.bySubject.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{s.name}</span>
                      <span className="shrink-0 text-xs">
                        {s.due > 0 ? (
                          <strong className="text-amber-600">{s.due} vencidos</strong>
                        ) : (
                          <span className="text-slate-400">
                            {s.total} cart{s.total === 1 ? 'ão' : 'ões'}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
