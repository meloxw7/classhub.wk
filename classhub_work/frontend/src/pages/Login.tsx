import { FormEvent, useState } from 'react';
import { GraduationCap, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Navigate, Link } from 'react-router-dom';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('aluno@classhub.local'),
    [password, setPassword] = useState('123456'),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  function fill(kind: 'aluno' | 'professor') {
    setEmail(`${kind}@classhub.local`);
    setPassword('123456');
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950">
      <div className="hidden lg:flex flex-col justify-center p-16 relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-24 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="text-4xl font-black">
            Class<span className="text-blue-400">Hub</span>
          </div>
          <p className="text-slate-300 text-xl mt-5 max-w-lg">
            Portal acadêmico integrado para materiais, notas, prazos, trabalhos e colaboração.
          </p>
          <div className="mt-10 space-y-4 text-slate-300">
            <p className="flex gap-3">
              <GraduationCap /> Experiência separada para aluno e professor
            </p>
            <p className="flex gap-3">
              <ShieldCheck /> Autenticação e permissões por perfil
            </p>
            <p className="flex gap-3">
              <Lock /> Conteúdos e anotações persistidos no PostgreSQL
            </p>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={submit} className="card w-full max-w-md p-7">
          <div className="mb-7">
            <div className="lg:hidden text-3xl font-black mb-5">
              Class<span className="text-blue-600">Hub</span>
            </div>
            <h1 className="text-2xl font-black">Entrar</h1>
            <p className="muted mt-1">Acesse seu ambiente acadêmico.</p>
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm mb-4">{error}</div>
          )}
          <label className="label">E-mail</label>
          <div className="relative mb-4">
            <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              className="input pl-10"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <label className="label">Senha</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              className="input pl-10"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button disabled={loading} className="btn-primary w-full mt-5">
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="text-right mt-3">
            <Link to="/resetar-senha" className="text-sm text-blue-600 font-semibold">
              Esqueci minha senha
            </Link>
          </p>
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500 mb-2">Acesso rápido (demo):</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fill('aluno')}
                className="btn-secondary flex-1 text-sm py-2"
              >
                Aluno
              </button>
              <button
                type="button"
                onClick={() => fill('professor')}
                className="btn-secondary flex-1 text-sm py-2"
              >
                Professor
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
