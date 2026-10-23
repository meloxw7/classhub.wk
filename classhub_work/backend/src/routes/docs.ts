import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'ClassHub API',
    version: '1.0.0',
    description:
      'Portal acadêmico integrado: disciplinas, materiais, agenda, trabalhos, fórum, chat, notificações e conversor ABNT.',
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
    { name: 'Salas' },
    { name: 'Comunidade' },
    { name: 'Mensagens diretas' },
    { name: 'Flashcards' },
    { name: 'Notificações' },
    { name: 'Progresso' },
    { name: 'Estatísticas' },
    { name: 'ABNT' },
    { name: 'Lumi (IA)' },
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
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  rememberMe: { type: 'boolean', description: 'Sessão de 30 dias (padrão: 1 dia)' },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary:
          'Cadastro (aluno livre, pode informar faculdade/instituição; professor exige código da instituição, que identifica a instituição automaticamente, e disciplina que leciona) → sessão automática',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password', 'role'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['ALUNO', 'PROFESSOR'] },
                  course: { type: 'string' },
                  semester: { type: 'string' },
                  ra: { type: 'string' },
                  institution: { type: 'string' },
                  institutionCode: { type: 'string' },
                  subjectName: { type: 'string' },
                },
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
    '/api/rooms': {
      get: { tags: ['Salas'], summary: 'Lista salas de estudo' },
      post: { tags: ['Salas'], summary: 'Cria sala (aluno ou professor)' },
    },
    '/api/rooms/{id}/posts': {
      get: { tags: ['Salas'], summary: 'Publicações da sala' },
      post: { tags: ['Salas'], summary: 'Publica na sala (texto + link opcional)' },
    },
    '/api/social/feed': {
      get: { tags: ['Comunidade'], summary: 'Feed: publicações próprias + de quem segue' },
    },
    '/api/social/posts': {
      post: {
        tags: ['Comunidade'],
        summary: 'Publica texto ou enquete (pollOptions: 2–5 opções)',
      },
    },
    '/api/social/posts/{id}/vote': {
      post: { tags: ['Comunidade'], summary: 'Vota/altera voto em enquete' },
    },
    '/api/social/users/{id}': {
      get: { tags: ['Comunidade'], summary: 'Perfil público + badges acadêmicos' },
    },
    '/api/social/users/{id}/follow': {
      post: { tags: ['Comunidade'], summary: 'Segue/deixa de seguir' },
    },
    '/api/direct/conversations': {
      get: { tags: ['Mensagens diretas'], summary: 'Lista conversas com última msg e não lidas' },
    },
    '/api/direct/{partnerId}': {
      get: { tags: ['Mensagens diretas'], summary: 'Histórico com usuário e marca como lido' },
    },
    '/api/direct/upload': {
      post: { tags: ['Mensagens diretas'], summary: 'Envia imagem/áudio na conversa (multipart)' },
    },
    '/api/flashcards': {
      get: { tags: ['Flashcards'], summary: 'Lista cartões do usuário (filtro por disciplina)' },
      post: { tags: ['Flashcards'], summary: 'Cria cartão (frente/verso, disciplina opcional)' },
    },
    '/api/flashcards/due': {
      get: { tags: ['Flashcards'], summary: 'Fila de revisão vencida' },
    },
    '/api/flashcards/stats': {
      get: { tags: ['Flashcards'], summary: 'Totais, vencidos e distribuição por caixa' },
    },
    '/api/flashcards/{id}/review': {
      post: { tags: ['Flashcards'], summary: 'Revisa cartão (GOOD sobe caixa, AGAIN volta à 1)' },
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
    '/api/tutor/chat': {
      post: {
        tags: ['Lumi (IA)'],
        summary: 'Conversa com a Lumi, assistente de estudos (Gemini) — resposta em streaming SSE',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'model'] },
                        content: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/tutor/pdf': {
      post: {
        tags: ['Lumi (IA)'],
        summary: 'Gera um PDF real (download) de uma resposta da Lumi (markdown formatado)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: { type: 'string' },
                  title: { type: 'string' },
                },
              },
            },
          },
        },
      },
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
