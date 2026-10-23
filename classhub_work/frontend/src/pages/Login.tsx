import { FormEvent, useState } from 'react';
import { GraduationCap, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Navigate, Link } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [remember, setRemember] = useState(true),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password, remember);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Não foi possível entrar.');
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-950/50 flex items-center justify-center mb-5">
            <GraduationCap size={28} />
          </div>
          <div className="text-4xl font-black">
            Class<span className="text-violet-400">Hub</span>
          </div>
          <p className="text-slate-300 text-xl mt-5 max-w-lg">
            Portal acadêmico integrado para materiais, notas, prazos, trabalhos e colaboração.
          </p>
          <div className="mt-10 space-y-4 text-slate-300">
            <p className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/10 text-violet-300 flex items-center justify-center shrink-0">
                <GraduationCap size={18} />
              </span>
              <span>Experiência separada para aluno e professor</span>
            </p>
            <p className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/10 text-violet-300 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </span>
              <span>Autenticação e permissões por perfil</span>
            </p>
            <p className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/10 text-violet-300 flex items-center justify-center shrink-0">
                <Lock size={18} />
              </span>
              <span>Conteúdos e anotações persistidos no PostgreSQL</span>
            </p>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={submit} className="card fade-rise w-full max-w-md p-7">
          <div className="mb-7">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-md shadow-violet-200 shrink-0">
                <GraduationCap size={22} />
              </div>
              <div className="text-2xl font-black">
                Class<span className="text-violet-600">Hub</span>
              </div>
            </div>
            <h1 className="text-2xl font-black">Entrar</h1>
            <p className="muted mt-1">Acesse seu ambiente acadêmico.</p>
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 p-3 text-sm mb-4">{error}</div>
          )}
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
          <label className="label">Senha</label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="flex items-center justify-between gap-3 mt-4">
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-violet-600"
              />
              <span className="text-sm text-slate-600">Lembrar de mim (30 dias)</span>
            </label>
            <Link to="/resetar-senha" className="text-sm text-violet-600 font-semibold shrink-0">
              Esqueci minha senha
            </Link>
          </div>
          <button disabled={loading} className="btn-primary w-full mt-6">
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="text-center mt-4 text-sm text-slate-600">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-violet-600 font-semibold">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
