import { useEffect, useRef, useState } from 'react';
import { Loader2, Pencil, Save, ShieldCheck, UserRound, Building2 } from 'lucide-react';

import { api, fileUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Skeleton } from '../components/Feedback';

export default function Profile() {
  const { updateUser } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [ra, setRa] = useState('');
  const [institution, setInstitution] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
        setUsername(response.data.username || '');
        setEmail(response.data.email);
        setRole(response.data.role);
        setCourse(response.data.course || '');
        setSemester(response.data.semester || '');
        setRa(response.data.ra || '');
        setInstitution(response.data.institution || '');
        setBio(response.data.bio || '');
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
        bio: bio.trim(),
        username: username.trim(),
      });

      updateUser({ name: response.data.name });

      toast.success('Dados atualizados.');
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
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Alterar foto de perfil"
                  className="relative group rounded-full transition duration-200 hover:scale-105 active:scale-95 shrink-0"
                >
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
                  <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-violet-600 border-2 border-white dark:border-[#14141a] grid place-items-center text-white shadow-md transition-transform duration-200 group-hover:scale-110">
                    <Pencil size={12} />
                  </span>
                </button>

                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Foto de perfil
                  </p>

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

            <label className="label">Usuário (@) — usado nas menções da comunidade</label>

            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none font-semibold">
                @
              </span>
              <input
                className="input pl-10"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20}
                placeholder="ex.: joao_silva"
              />
            </div>

            <label className="label">E-mail (identificador da conta)</label>

            <input className="input mb-4" value={email} disabled />

            <label className="label">Bio (aparece no seu perfil da comunidade)</label>

            <textarea
              className="input resize-none mb-4"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Ex.: Estudante de SI, apaixonado por bancos de dados…"
            />

            <p className="text-xs text-slate-400 mb-4">{bio.length}/300</p>

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

            {role === 'ALUNO' && (course || semester || ra || institution) && (
              <div className="space-y-1 mb-4 text-sm text-slate-600">
                {course && (
                  <p>
                    <span className="font-semibold">Curso:</span> {course}
                  </p>
                )}
                {institution && (
                  <p>
                    <span className="font-semibold">Faculdade/Instituição:</span> {institution}
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
