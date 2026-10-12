export type Role = 'PROFESSOR' | 'ALUNO';
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_path?: string | null;
};
