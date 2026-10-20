export type Role = 'PROFESSOR' | 'ALUNO';
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  username?: string | null;
  avatar_path?: string | null;
  course?: string | null;
  semester?: string | null;
  ra?: string | null;
  institution?: string | null;
};
