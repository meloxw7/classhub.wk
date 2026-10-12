import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'ClassHub API',
    version: '1.0.0',
    description:
      'Portal acadêmico integrado: disciplinas, materiais, agenda, trabalhos, fórum, presença por PIN, chat, notificações e conversor ABNT.',
  },
  servers: [{ url: '/', description: 'Servidor atual' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth' },
    { name: 'Disciplinas' },
    { name: 'Materiais' },
    { name: 'Notas' },
    { name: 'Agenda' },
    { name: 'Usuários' },
    { name: 'Avisos' },
    { name: 'Trabalhos' },
    { name: 'Presença' },
    { name: 'Fórum' },
    { name: 'Salas' },
    { name: 'Notificações' },
    { name: 'Progresso' },
    { name: 'Estatísticas' },
    { name: 'ABNT' },
    { name: 'Chat' },
    { name: 'Boletim' },
    { name: 'Infra' },
  ],
  paths: {
    '/api/health': {
      get: { tags: ['Infra'], summary: 'Health check', security: [] },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login (e-mail + senha) → token, refreshToken e usuário',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renova a sessão com o refreshToken (rotaciona o token usado)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    '/api/auth/logout': {
      post: { tags: ['Auth'], summary: 'Revoga o refreshToken informado', security: [] },
    },
    '/api/auth/forgot': {
      post: { tags: ['Auth'], summary: 'Solicita link de recuperação de senha por e-mail', security: [] },
    },
    '/api/auth/reset': {
      post: {
        tags: ['Auth'],
        summary: 'Redefine a senha com o token recebido por e-mail',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string' },
                  newPassword: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
      },
    },
    '/api/subjects': {
      get: { tags: ['Disciplinas'], summary: 'Lista disciplinas' },
      post: { tags: ['Disciplinas'], summary: 'Cria disciplina (professor)' },
    },
    '/api/materials': {
      get: { tags: ['Materiais'], summary: 'Lista materiais (filtros por disciplina e tag)' },
      post: { tags: ['Materiais'], summary: 'Publica material (professor, multipart, até 50 MB)' },
    },
    '/api/materials/{id}/progress': {
      patch: { tags: ['Materiais'], summary: 'Marca/desmarca material como concluído (aluno)' },
    },
    '/api/materials/{id}/version': {
      post: { tags: ['Materiais'], summary: 'Envia nova versão do arquivo (professor)' },
    },
    '/api/materials/{id}/versions': {
      get: { tags: ['Materiais'], summary: 'Histórico de versões' },
    },
    '/api/materials/{id}': {
      delete: { tags: ['Materiais'], summary: 'Exclui material (professor)' },
    },
    '/api/notes/{subjectId}': {
      get: { tags: ['Notas'], summary: 'Bloco de notas do usuário para a disciplina' },
      put: { tags: ['Notas'], summary: 'Salva o conteúdo do bloco de notas' },
    },
    '/api/events': {
      get: { tags: ['Agenda'], summary: 'Lista eventos visíveis ao usuário (filtra destinatários)' },
      post: {
        tags: ['Agenda'],
        summary: 'Cria evento (visibility: ALL / SELECTED / PRIVATE)',
      },
    },
    '/api/notices': {
      get: { tags: ['Avisos'], summary: 'Lista avisos (fixados primeiro)' },
      post: { tags: ['Avisos'], summary: 'Publica aviso (professor, opção de fixar)' },
    },
    '/api/assignments': {
      get: { tags: ['Trabalhos'], summary: 'Lista trabalhos' },
      post: { tags: ['Trabalhos'], summary: 'Cria trabalho (professor) — gera evento + notifica' },
    },
    '/api/assignments/{id}': {
      delete: { tags: ['Trabalhos'], summary: 'Exclui trabalho (professor, com entregas e evento)' },
    },
    '/api/assignments/{id}/submit': {
      post: { tags: ['Trabalhos'], summary: 'Entrega/reenvio de trabalho (aluno, multipart)' },
    },
    '/api/assignments/{id}/submissions': {
      get: { tags: ['Trabalhos'], summary: 'Entregas do trabalho (professor)' },
    },
    '/api/assignments/submissions/{id}': {
      patch: { tags: ['Trabalhos'], summary: 'Corrige entrega com nota + feedback (professor)' },
    },
    '/api/attendance/sessions': {
      get: { tags: ['Presença'], summary: 'Histórico de chamadas (professor)' },
    },
    '/api/attendance/open': {
      get: { tags: ['Presença'], summary: 'PIN ativo (professor)' },
      post: { tags: ['Presença'], summary: 'Abre chamada com PIN de 6 dígitos (professor)' },
    },
    '/api/attendance/sessions/{id}/close': {
      patch: { tags: ['Presença'], summary: 'Encerra chamada antecipadamente (professor)' },
    },
    '/api/attendance/mark': {
      post: { tags: ['Presença'], summary: 'Registra presença com o PIN (aluno)' },
    },
    '/api/attendance/mine': {
      get: { tags: ['Presença'], summary: 'Presenças do aluno' },
    },
    '/api/forum': {
      get: { tags: ['Fórum'], summary: 'Lista perguntas' },
      post: { tags: ['Fórum'], summary: 'Cria pergunta vinculada a um material' },
    },
    '/api/forum/{id}/replies': {
      post: { tags: ['Fórum'], summary: 'Responde pergunta (professor ganha selo oficial)' },
    },
    '/api/rooms': {
      get: { tags: ['Salas'], summary: 'Lista salas de estudo' },
      post: { tags: ['Salas'], summary: 'Cria sala (aluno ou professor)' },
    },
    '/api/rooms/{id}/posts': {
      get: { tags: ['Salas'], summary: 'Publicações da sala' },
      post: { tags: ['Salas'], summary: 'Publica na sala (texto + link opcional)' },
    },
    '/api/notifications': {
      get: { tags: ['Notificações'], summary: 'Lista notificações do usuário' },
      delete: { tags: ['Notificações'], summary: 'Apaga todas (com confirmação)' },
    },
    '/api/notifications/{id}/read': {
      patch: { tags: ['Notificações'], summary: 'Marca uma como lida' },
    },
    '/api/notifications/read-all': {
      patch: { tags: ['Notificações'], summary: 'Marca todas como lidas' },
    },
    '/api/notifications/{id}': {
      delete: { tags: ['Notificações'], summary: 'Apaga uma notificação' },
    },
    '/api/notifications/subscribe': {
      post: { tags: ['Notificações'], summary: 'Registra subscription Web Push' },
    },
    '/api/progress': {
      get: { tags: ['Progresso'], summary: 'Progresso de materiais concluídos por disciplina' },
    },
    '/api/stats': {
      get: { tags: ['Estatísticas'], summary: 'Cards do dashboard + badge de não lidas' },
    },
    '/api/users/students': {
      get: { tags: ['Usuários'], summary: 'Lista alunos (professor)' },
    },
    '/api/users/me': {
      get: { tags: ['Usuários'], summary: 'Perfil do usuário logado' },
      put: { tags: ['Usuários'], summary: 'Atualiza o nome' },
    },
    '/api/users/password': {
      put: { tags: ['Usuários'], summary: 'Troca de senha (exige senha atual)' },
    },
    '/api/users/me/avatar': {
      post: { tags: ['Usuários'], summary: 'Upload de foto (JPG/PNG até 2 MB, multipart)' },
    },
    '/api/abnt/convert': {
      post: { tags: ['ABNT'], summary: 'Extrai texto de .docx/.pdf/.txt/.md (multipart)' },
    },
    '/api/abnt/references': {
      get: { tags: ['ABNT'], summary: 'Referências salvas do usuário' },
      post: { tags: ['ABNT'], summary: 'Salva referência formatada (NBR 6023)' },
    },
    '/api/abnt/references/{id}': {
      delete: { tags: ['ABNT'], summary: 'Exclui referência salva' },
    },
    '/api/abnt/export': {
      post: { tags: ['ABNT'], summary: 'Gera .docx ABNT (NBR 14724) para download' },
    },
    '/api/chat/{subjectId}': {
      get: { tags: ['Chat'], summary: 'Últimas 100 mensagens da disciplina' },
    },
    '/api/grades': {
      get: { tags: ['Boletim'], summary: 'Notas por disciplina (boletim)' },
    },
  },
} as const;

const router = Router();
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(spec as object));
router.get('/openapi.json', (_req, res) => {
  res.json(spec);
});
export default router;
