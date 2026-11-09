import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  rememberMe: z.boolean().optional(),
  twoFactorToken: z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos').optional(),
  twoFactorBackupCode: z.string().optional(),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(12, 'Senha deve ter pelo menos 12 caracteres'),
  role: z.enum(['ALUNO', 'PROFESSOR']),
  username: z.string().regex(/^[a-z0-9_]{3,20}$/, 'Usuário: 3-20 chars, lowercase, números, _').optional(),
  course: z.string().max(120).optional(),
  semester: z.string().max(30).optional(),
  ra: z.string().max(40).optional(),
  institution: z.string().max(120).optional(),
  institutionCode: z.string().optional(),
  subjectName: z.string().max(160).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória'),
  newPassword: z.string().min(12, 'Nova senha deve ter pelo menos 12 caracteres'),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120).optional(),
  bio: z.string().max(300).optional(),
  username: z.string().regex(/^[a-z0-9_]{3,20}$/, 'Usuário: 3-20 chars, lowercase, números, _').optional(),
});

export const materialCreateSchema = z.object({
  subjectId: z.string().uuid('ID de disciplina inválido'),
  title: z.string().min(1, 'Título obrigatório').max(200),
  description: z.string().optional(),
  type: z.enum(['VIDEO', 'PDF', 'LINK', 'EXERCICIO', 'PROVA']),
  url: z.string().url('URL inválida').optional().or(z.literal('')),
  tags: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const eventCreateSchema = z.object({
  subjectId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  eventDate: z.string().datetime(),
  type: z.string().max(30).optional(),
  color: z.string().max(20).optional(),
  visibility: z.enum(['ALL', 'SELECTED', 'PRIVATE']).optional(),
});

export const noticeCreateSchema = z.object({
  subjectId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  pinned: z.boolean().optional(),
});

export const assignmentCreateSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().datetime(),
  maxScore: z.number().positive().max(100).optional(),
});

export const subjectCreateSchema = z.object({
  name: z.string().min(1).max(160),
  code: z.string().max(50).optional(),
  semester: z.string().max(30).optional(),
});

export const roomCreateSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().optional(),
});

export const socialPostCreateSchema = z.object({
  content: z.string().min(1).max(5000),
  pollOptions: z.array(z.string().min(1).max(100)).max(4).optional(),
  repostMaterialId: z.string().uuid().optional(),
});

export const directMessageCreateSchema = z.object({
  recipientId: z.string().uuid(),
  content: z.string().max(2000).optional(),
  type: z.enum(['TEXT', 'IMAGE', 'AUDIO']).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
  newPassword: z.string().min(12, 'Nova senha deve ter pelo menos 12 caracteres'),
});

export const twoFactorVerifySchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos').optional(),
  backupCode: z.string().optional(),
}).refine((data) => data.token || data.backupCode, {
  message: 'Token ou código de backup obrigatório',
});

export const twoFactorDisableSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos'),
});

export function validate(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return res.status(400).json({ message: errors });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return res.status(400).json({ message: errors });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return res.status(400).json({ message: errors });
    }
    req.params = result.data;
    next();
  };
}