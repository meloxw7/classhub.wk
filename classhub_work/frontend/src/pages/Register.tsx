import { FormEvent, useState } from 'react';
import { GraduationCap, Loader2, ShieldCheck, UserRound, Building2, Mail, Lock, BookOpen, IdCard, CalendarDays } from 'lucide-react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'ALUNO' | 'PROFESSOR'>('ALUNO');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [ra, setRa] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    if (role === 'PROFESSOR' && !institutionCode.trim()) {
      setError('Professores precisam informar o código da instituição.');
      return;
    }
    if (role === 'PROFESSOR' && !subjectName.trim()) {
      setError('Informe o nome da disciplina que você leciona.');
      return;
    }
    setLoading(true);
    try {
      await register({
        name,
        email,
        password,
        role,
        course: role === 'ALUNO' ? course : undefined,
        semester: role === 'ALUNO' ? semester : undefined,
        ra: role === 'ALUNO' ? ra : undefined,
        institutionCode: role === 'PROFESSOR' ? institutionCode : undefined,
        subjectName: role === 'PROFESSOR' ? subjectName : undefined,
      });
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Não foi possível criar sua conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950">
      <div className="hidden lg:flex flex-col justify-center p-16 relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 text-white">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-24 w-96 h-96 bg-violet-400/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="text-4xl font-black">
            Class<span className="text-violet-400">Hub</span>
          </div>
          <p className="text-slate-300 text-xl mt-5 max-w-lg">
            Crie sua conta e acesse materiais, prazos, trabalhos e colaboração da sua turma.
          </p>
          <div className="mt-10 space-y-4 text-slate-300">
            <p className="flex items-center gap-3">
              <GraduationCap size={20} className="shrink-0" />
              <span>Alunos entram livremente com curso, período e RA</span>
            </p>
            <p className="flex items-center gap-3">
              <Building2 size={20} className="shrink-0" />
              <span>
                Professores entram com o código da instituição (identificada automaticamente)
              </span>
            </p>
            <p className="flex items-center gap-3">
              <ShieldCheck size={20} className="shrink-0" />
              <span>Sessão segura com JWT e renovação automática</span>
            </p>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={submit} className="card w-full max-w-md p-7 my-8">
          <div className="mb-6">
            <div className="lg:hidden text-3xl font-black mb-5">
              Class<span className="text-violet-600">Hub</span>
            </div>
            <h1 className="text-2xl font-black">Criar conta</h1>
            <p className="muted mt-1">Responda o cadastro para entrar no ambiente acadêmico.</p>
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 p-3 text-sm mb-4">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => setRole('ALUNO')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                role === 'ALUNO'
                  ? 'border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <GraduationCap size={16} />
              Sou aluno
            </button>
            <button
              type="button"
              onClick={() => setRole('PROFESSOR')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                role === 'PROFESSOR'
                  ? 'border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <UserRound size={16} />
              Sou professor
            </button>
          </div>

          <label className="label">Nome completo</label>
          <div className="relative mb-4">
            <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
            <input
              className="input pl-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <label className="label">E-mail</label>
          <div className="relative mb-4">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
            <input
              className="input pl-10"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                <input
                  className="input pl-10"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                <input
                  className="input pl-10"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {role === 'ALUNO' ? (
            <>
              <label className="label">Curso</label>
              <div className="relative mb-4">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                <input
                  className="input pl-10"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="label">Semestre/Período</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                    <input
                      className="input pl-10"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Matrícula (RA)</label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                    <input
                      className="input pl-10"
                      value={ra}
                      onChange={(e) => setRa(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <label className="label">Código da instituição</label>
              <div className="relative mb-4">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                <input
                  className="input pl-10"
                  value={institutionCode}
                  onChange={(e) => setInstitutionCode(e.target.value)}
                  required
                />
              </div>
              <label className="label">Disciplina que você leciona</label>
              <div className="relative mb-4">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                <input
                  className="input pl-10"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <button disabled={loading} className="btn-primary w-full mt-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Criando conta...' : 'Criar conta e entrar'}
          </button>
          <p className="text-center mt-4 text-sm text-slate-600">
            Já tem conta?{' '}
            <Link to="/login" className="text-violet-600 font-semibold">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
