import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function ResetPassword() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!token) {
      setLoading(true);
      try {
        await api.post('/auth/forgot', { email });
        setSent(true);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Não foi possível enviar o e-mail.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset', { token, newPassword: password });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-7">
        <h1 className="text-2xl font-black">{token ? 'Redefinir senha' : 'Recuperar acesso'}</h1>
        <p className="muted mt-1">
          {token
            ? 'Escolha uma nova senha para sua conta.'
            : 'Informe seu e-mail para receber um link de redefinição.'}
        </p>
        {error && (
          <div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm mt-4">{error}</div>
        )}
        {sent && (
          <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm mt-4">
            Se o e-mail estiver cadastrado, você receberá o link em instantes.
          </div>
        )}
        {!token && (
          <>
            <label className="label mt-4">E-mail</label>
            <div className="relative mb-4">
              <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                className="input pl-10"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </>
        )}
        {token && (
          <>
            <label className="label mt-4">Nova senha</label>
            <div className="relative mb-4">
              <KeyRound className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                className="input pl-10"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <label className="label">Confirmar nova senha</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                className="input pl-10"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          </>
        )}
        <button disabled={loading} className="btn-primary w-full mt-5">
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {loading ? 'Enviando...' : token ? 'Salvar nova senha' : 'Enviar link'}
        </button>
        <p className="text-sm mt-5 text-center">
          <Link to="/login" className="text-violet-600 font-semibold">
            Voltar ao login
          </Link>
        </p>
      </form>
    </div>
  );
}
