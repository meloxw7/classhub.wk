import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck, UserRound, Building2 } from 'lucide-react';

import { api, fileUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Skeleton } from '../components/Feedback';

export default function Profile() {
  const { updateUser } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [ra, setRa] = useState('');
  const [institution, setInstitution] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const response = await api.get('/users/me');

        setName(response.data.name);
        setEmail(response.data.email);
        setRole(response.data.role);
        setCourse(response.data.course || '');
        setSemester(response.data.semester || '');
        setRa(response.data.ra || '');
        setInstitution(response.data.institution || '');
        setAvatarPath(response.data.avatar_path || null);
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        toast.error('Não foi possível carregar o perfil.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [toast]);

  async function saveName() {
    if (!name.trim()) {
      toast.error('Informe o nome.');
      return;
    }

    setSavingName(true);

    try {
      const response = await api.put('/users/me', {
        name: name.trim(),
      });

      updateUser({ name: response.data.name });

      toast.success('Nome atualizado.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível salvar o nome.');
    } finally {
      setSavingName(false);
    }
  }

  async function saveAvatar() {
    if (!avatarFile) {
      toast.error('Selecione uma imagem JPG ou PNG.');
      return;
    }

    setSavingAvatar(true);

    try {
      const formData = new FormData();

      formData.append('avatar', avatarFile);

      const response = await api.post('/users/me/avatar', formData);

      setAvatarPath(response.data.avatar_path || null);
      setAvatarFile(null);

      updateUser({ avatar_path: response.data.avatar_path });

      toast.success('Foto de perfil atualizada.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível salvar a foto.');
    } finally {
      setSavingAvatar(false);
    }
  }

  async function changePassword() {
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      toast.error('Preencha todos os campos de senha.');
      return;
    }

    if (passwords.next.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (passwords.next !== passwords.confirm) {
      toast.error('A confirmação não confere com a nova senha.');
      return;
    }

    setSavingPassword(true);

    try {
      await api.put('/users/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });

      setPasswords({
        current: '',
        next: '',
        confirm: '',
      });

      toast.success('Senha alterada com sucesso.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível alterar a senha.');
    } finally {
      setSavingPassword(false);
    }
  }

  const avatarUrl = avatarFile
    ? URL.createObjectURL(avatarFile)
    : avatarPath
      ? fileUrl(avatarPath)
      : '';

  return (
    <div>
      <div className="mb-7">
        <p className="text-violet-600 font-semibold">Conta</p>

        <h2 className="section-title mt-1">Meu perfil</h2>

        <p className="muted mt-2">Atualize seu nome, foto de perfil e senha.</p>
      </div>

      {loading ? (
        <div className="card p-5">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="card overflow-hidden p-0">
            <div className="h-24 bg-gradient-to-r from-violet-100 via-fuchsia-100 to-violet-50 dark:from-violet-950 dark:via-fuchsia-950/60 dark:to-violet-900" />
            <div className="p-5 -mt-12 relative">
              <h3 className="font-bold mb-4">Dados pessoais</h3>

              <div className="flex items-end gap-4 mb-5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Foto de perfil"
                    className="w-16 h-16 rounded-full object-cover border border-slate-200 ring-4 ring-white dark:ring-[#14141a]"
                  />
                ) : (
                  <span className="w-16 h-16 rounded-full bg-violet-600 text-white grid place-items-center shrink-0 ring-4 ring-white dark:ring-[#14141a]">
                    <UserRound size={26} />
                  </span>
                )}

                <div>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="input text-sm"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  />

                  <p className="text-xs text-slate-400 mt-1">JPG ou PNG, até 2 MB.</p>

                  {avatarFile && (
                    <button className="btn-primary mt-2" onClick={saveAvatar} disabled={savingAvatar}>
                      {savingAvatar ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Salvar foto
                    </button>
                  )}
                </div>
              </div>

              <label className="label">Nome</label>

            <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} />

            <label className="label">E-mail (identificador da conta)</label>

            <input className="input mb-4" value={email} disabled />

            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-violet-600" />

              <span className="text-sm font-semibold">
                Perfil: {role === 'PROFESSOR' ? 'Professor' : 'Aluno'}
              </span>
            </div>

            {role === 'PROFESSOR' && institution && (
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={16} className="text-violet-600" />

                <span className="text-sm font-semibold">Instituição: {institution}</span>
              </div>
            )}

            {role === 'ALUNO' && (course || semester || ra) && (
              <div className="space-y-1 mb-4 text-sm text-slate-600">
                {course && (
                  <p>
                    <span className="font-semibold">Curso:</span> {course}
                  </p>
                )}
                {semester && (
                  <p>
                    <span className="font-semibold">Semestre/Período:</span> {semester}
                  </p>
                )}
                {ra && (
                  <p>
                    <span className="font-semibold">Matrícula (RA):</span> {ra}
                  </p>
                )}
              </div>
            )}

            <button className="btn-primary" onClick={saveName} disabled={savingName}>
              {savingName ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Salvar alterações
                </>
              )}
            </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-4">Alterar senha</h3>

            <label className="label">Senha atual</label>

            <input
              type="password"
              className="input mb-4"
              value={passwords.current}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  current: e.target.value,
                })
              }
            />

            <label className="label">Nova senha</label>

            <input
              type="password"
              className="input mb-4"
              value={passwords.next}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  next: e.target.value,
                })
              }
            />

            <label className="label">Confirmar nova senha</label>

            <input
              type="password"
              className="input mb-4"
              value={passwords.confirm}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  confirm: e.target.value,
                })
              }
            />

            <button className="btn-primary" onClick={changePassword} disabled={savingPassword}>
              {savingPassword ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Alterar senha
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
