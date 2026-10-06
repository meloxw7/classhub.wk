# ClassHub

Portal acadêmico integrado: disciplinas, materiais, agenda com calendário, trabalhos, fórum, presença por PIN e notificações.

Stack: React 19 + Vite + Tailwind (frontend) · Express 5 + PostgreSQL (backend)

## Funcionalidades

### Autenticação e segurança
- Login com e-mail/senha (JWT, expira em 8h; senha com hash bcrypt)
- Dois perfis com permissões distintas: **ALUNO** e **PROFESSOR** (middleware de role no backend)
- WebSocket do chat autenticado com o mesmo JWT (recusa conexão sem token válido)
- Botões de acesso rápido na tela de login (preenchem contas demo)
- Sessão persistida no `localStorage`; expiração do token (401) faz logout automático e redireciona ao login
- Rate limit no `/api/auth`: máx. 30 tentativas por IP por minuto (erro 429)
- CORS restrito à origem do frontend (`CLIENT_URL`)
- Rotas privadas no frontend (redirect para `/login` quando não autenticado)

### Dashboard (visão geral)
- 4 cards de estatísticas por perfil:
  - Aluno: total de tarefas, provas futuras, tarefas atrasadas, tarefas concluídas
  - Professor: total de tarefas, provas futuras, entregas recebidas, pendentes de correção
- Alerta de tarefas atrasadas (aluno) com lista e link "Resolver agora"
- "Próximas entregas": as 5 mais próximas com selo de urgência (menos de 24h / 48h / esta semana / com calma)
- Painel "Tarefas por disciplina" (contagem ordenada)
- Painel "Próximas provas" (4 primeiras) — respeita a visibilidade: cada usuário vê só as marcações destinadas a si
- Skeletons de carregamento e estados vazios em todos os painéis

### Disciplinas
- Listagem em cards com código, iniciais coloridas e professor responsável
- Detalhe da disciplina (`/disciplinas/:id`): materiais, próximos eventos (respeitando a visibilidade das marcações), barra de progresso (% de materiais concluídos — aluno), professor e atalhos
- Criação de disciplina (professor): nome + código; professor fica como responsável

### Materiais
- Publicação (professor) com: disciplina, título, descrição, tipo (`PDF`, `VIDEO`, `LINK`, `EXERCICIO`, `PROVA`), URL opcional, tags separadas por vírgula, data de entrega e upload de arquivo (máx. **50 MB**)
- Exercícios/provas com data de entrega criam evento automaticamente na agenda
- Filtros por disciplina e por tag (`#prova`, `#slides`, etc.)
- Aluno marca/desmarca material como concluído (alimentando o progresso por disciplina)
- Controle de **versões**: professor envia nova versão do arquivo; histórico de versões consultável (API)
- Exclusão de material (professor)
- Notificação automática a todos os alunos ao publicar material
- Links diretos para abrir arquivo hospedado (`/uploads`) ou URL externa

### Bloco de notas
- Notas pessoais por disciplina, por usuário
- Salvamento automático (debounce 800ms): salva no `localStorage` e sincroniza com o servidor; se offline, mantém local e mostra "aguardando conexão"
- Exportar/imprimir em PDF (abre janela de impressão formatada)

### Agenda acadêmica
- Calendário mensal interativo com marcadores de eventos por dia
- Painel do dia selecionado com detalhes (tipo, disciplina, autor, hora, descrição, cor)
- **Visibilidade das marcações (destinatários)**:
  - **Aluno**: toda marcação é **individual** — só o próprio aluno a vê (forçado pelo backend)
  - **Professor** escolhe entre: "Marcar para toda a turma" (todos veem), "Marcar para alunos selecionados" (checkbox de destinatários) e "Marcar individual (só para mim)"
- A listagem da agenda (`GET /events`) filtra por usuário: cada um vê apenas marcações para toda a turma, as direcionadas a si ou as próprias
- Criação de evento: disciplina, tipo (`PROVA`, `TRABALHO`, `AULA`, `OUTRO`), título, data/hora, descrição e escolha de cor
- Notificação respeita os destinatários: turma toda → todos os alunos; selecionados → apenas os escolhidos; individual → ninguém
- **Lembretes automáticos**: backend verifica a cada 30 min eventos das próximas 24h e notifica apenas o público-alvo de cada evento (todos, destinatários ou o autor)

### Trabalhos (assignments)
- Criação (professor): disciplina, título, descrição, data de entrega, nota máxima (padrão 10) → gera evento na agenda automaticamente + notifica todos os alunos
- Entrega (aluno): upload de arquivo com validação de formato (`.pdf`, `.docx`, `.zip`, `.mp4`, `.png`, `.jpg`, `.jpeg`), arquivo vazio recusado; reenvio substitui a entrega anterior
- Aluno vê status (Enviado/Pendente), nota recebida e feedback
- Professor lista entregas por trabalho (aluno, arquivo, data) e corrige com nota + feedback → aluno é notificado ("Trabalho corrigido")
- Contadores por trabalho: total de entregas e pendentes de correção
- Exclusão de trabalho (professor) com diálogo de confirmação (remove entregas e o evento vinculado)

### Presença (chamada por PIN)
- Professor abre chamada: disciplina + duração (1–120 min, padrão 10) → gera **PIN de 6 dígitos** com expiração
- Professor vê PIN ativo em destaque, histórico das últimas 20 chamadas com contagem de presentes e pode encerrar antecipadamente
- Aluno registra presença digitando o PIN (só dígitos, 6 posições); PIN inválido/expirado ou presença duplicada retornam erro
- Histórico de presenças do aluno (disciplina + data/hora)

### Fórum de dúvidas
- Pergunta vinculada a um material (aluno ou professor)
- Respostas em linha; respostas de professor ganham selo **"Resposta oficial"**
- Pergunta marcada como respondida automaticamente ao receber resposta
- Autor da pergunta recebe notificação de nova resposta

### Salas de estudo
- Salas de estudo por disciplina criadas por **aluno ou professor** (nome + descrição)
- Feed de publicações dentro da sala (texto + link opcional), ordenado por data
- Contagem de publicações por sala

### Avisos (comunicados)
- Professor publica aviso por disciplina com opção de **fixar** (aparece primeiro na listagem)
- Publicação notifica todos os alunos automaticamente

### Notificações
- Central de notificações (`/notificacoes`) + menu suspenso no topo (últimas 8)
- Cada notificação exibe **chip com o tipo** (Material, Evento, Aviso, Trabalho, Correção, Fórum, Info) — diferenciação visual no menu e na central
- **Notificações direcionadas**: eventos marcados para alunos selecionados notificam apenas esses alunos; marcações individuais não notificam ninguém
- Badge de não lidas na sidebar e no menu, atualizado a cada 15s (via `/stats`)
- Marcar como lida (individual) e marcar todas como lidas
- Apagar individual com confirmação para apagar todas
- Ativação de notificações do navegador (Notification API; requer HTTPS em produção); permissão já concedida é detectada automaticamente ao reentrar
- Polling a cada 10s exibe notificações novas no navegador (quando ativadas); **cada alerta do navegador é exibido uma única vez** — IDs exibidos ficam persistidos no `localStorage` por usuário, sem repetir em logout/login ou recarga
- Endpoint de assinatura Push (`/notifications/subscribe`) para registro de subscriptions Web Push
- Notificações geradas por: novo material, novo evento (respeitando destinatários), novo aviso, novo trabalho, trabalho corrigido, nova resposta no fórum, lembrete de evento (respeitando destinatários)

### Perfil e conta
- Página "Meu perfil" (`/perfil`), acessível pelo bloco da conta na sidebar (com foto ou iniciais)
- Editar nome (e-mail é fixo — identificador da conta)
- **Foto de perfil**: upload de JPG/PNG até 2 MB, com preview antes de salvar; exibida na sidebar e no chat
- **Trocar senha**: exige senha atual (validada com bcrypt), nova senha mínima de 6 caracteres + confirmação
- Ao salvar, nome/foto propagam para todo o site na hora (contexto de autenticação + `localStorage`)

### Chat da turma (tempo real)
- Página "Chat da turma" (`/chat`) — mensagens ao vivo por disciplina via **WebSocket** (lib `ws`, mesma porta da API)
- Conexão autenticada por JWT (query string); reconexão automática a cada 2s; indicador Conectado/Reconectando
- **Histórico**: últimas 100 mensagens por disciplina (`GET /api/chat/:subjectId`), depois tudo ao vivo
- **Presença**: lista "Online agora" com quem está na sala (broadcast de entrada/saída)
- **"Está digitando..."**: indicador em tempo real (debounce de 2s, expira em 4s)
- Mensagens com avatar/foto, nome, hora; próprias em destaque (direita, azul); máx. 1000 caracteres
- Salas por disciplina: trocar o seletor entra/sai da sala; mensagens persistidas na tabela `chat_messages`

### Conversor ABNT (NBR 14724 / NBR 6023)
- Página "Conversor ABNT" (`/abnt`) com duas abas: **Converter documento** e **Referências**
- **Conversão completa** (nada do original é descartado):
  - `.docx` — parser próprio (jszip + leitura direta do `word/document.xml`): extrai parágrafos, **caixas de texto** (capas/folhas de rosto), texto de tabelas (células como parágrafos) e **imagens embutidas** (com posição e dimensões); mammoth fica como fallback
  - `.pdf` — extração de texto via pdf-parse (PDF escaneado/imagem retorna erro explicativo)
  - `.txt`/`.md` — leitura direta
- **Sumário (SUMÁRIO) gerado automaticamente**: entradas do sumário original (campo TOC do Word) são removidas; o .docx exportado traz campo TOC nativo com os **números de página corretos** (Word atualiza os campos ao abrir — `updateFields`); títulos usam estilos `Heading 1/2/3` reais
- **Capa NBR 14724 sempre gerada** pelo formulário: a capa/folha de rosto original é detectada (tudo antes do primeiro título), removida do corpo e usada para **pré-preencher o formulário** (instituição, autor, título, tipo de trabalho, curso, cidade, ano e orientador)
- **Saída formatada ABNT**: Times New Roman 12, espaçamento 1,5, margens 3 cm (superior/esquerda) e 2 cm (inferior/direita), parágrafos justificados com recuo de 1,25 cm
- **Exportação em dois formatos**:
  - `.docx` editável no Word — capa, SUMÁRIO (campo TOC), corpo com imagens reembutidas e REFERÊNCIAS em páginas próprias
  - PDF via janela de impressão — inclui capa, sumário (lista sem números, que só o Word calcula), corpo com imagens e referências
- Pré-visualização do trabalho formatado na tela antes de exportar (com sumário e imagens)
- **Gerador de referências (NBR 6023)**: tipos livro, artigo de revista, site e TCC/monografia → formulário → string formatada com pré-visualização → **salva no banco** por usuário (tabela `abnt_references`)
- Lista "Minhas referências" com exclusão; opção de incluir todas (ordem alfabética) na seção REFERÊNCIAS do documento exportado
- Upload até 50 MB; payload de exportação da rota `/api/abnt` aceita até 80 MB (imagens em base64)

- Atalhos rápidos: publicar material, gerenciar trabalhos, abrir chamada
- Formulário de publicação de aviso (com opção de fixar)

### UX / PWA
- PWA: manifest + service worker em produção (cache offline); em dev o SW é desregistrado para evitar cache velho
- Toasts de sucesso/erro em todas as ações
- Diálogos de confirmação para ações destrutivas
- ErrorBoundary global (tela de erro amigável)
- Skeletons de carregamento e estados vazios ilustrados
- Layout responsivo: sidebar fixa no desktop, drawer no mobile
- Cores determinísticas por disciplina (iniciais) e tons por progresso

### Infra da API
- `GET /api/health` para health check
- Uploads servidos estaticamente em `/uploads` (nome de arquivo sanitizado)
- Erros de upload padronizados (limite de 50 MB)
- Índices no banco para materiais por disciplina, eventos por data, destinatários de eventos, trabalhos por prazo, notificações por usuário e referências ABNT por usuário
- Build TypeScript (`npm run check`, `npm run build`)

## Pré-requisitos

- Node.js 20+
- PostgreSQL 16+ com `psql` no PATH (no Windows, adicione `C:\Program Files\PostgreSQL\<versão>\bin` ao PATH)

## Setup

```bash
# 1. Banco (roda schema.sql + seed.sql)
#    Ajuste a URL em backend/package.json -> script "db:init" se necessário
cd backend
npm install
npm run db:init

# 2. Variáveis de ambiente
#    Backend:  copie backend/.env.example para backend/.env e preencha
#    Frontend: copie frontend/.env.example para frontend/.env se a API não estiver em http://localhost:4000/api

# 3. Rodar em desenvolvimento (dois terminais)
cd backend   && npm run dev     # API em http://localhost:4000
cd frontend  && npm run dev     # App em http://localhost:5173
```

## Contas demo

| Perfil    | E-mail                    | Senha  |
|-----------|---------------------------|--------|
| Aluno     | aluno@classhub.local      | 123456 |
| Professor | professor@classhub.local  | 123456 |

## API (resumo de endpoints)

| Área          | Endpoints |
|---------------|-----------|
| Auth          | `POST /api/auth/login` |
| Disciplinas   | `GET/POST /api/subjects` |
| Materiais     | `GET/POST /api/materials`, `PATCH /api/materials/:id/progress`, `POST /api/materials/:id/version`, `GET /api/materials/:id/versions`, `DELETE /api/materials/:id` |
| Notas         | `GET/PUT /api/notes/:subjectId` |
| Agenda        | `GET/POST /api/events` (POST aceita `visibility`: `ALL`/`SELECTED`/`PRIVATE` e `targetIds`; GET filtra por destinatário) |
| Usuários      | `GET /api/users/students` (professor: lista alunos para seleção de destinatários) |
| Perfil        | `GET /api/users/me`, `PUT /api/users/me`, `PUT /api/users/password`, `POST /api/users/me/avatar` |
| Chat          | `GET /api/chat/:subjectId` (histórico) + WebSocket em `ws://…?token=…` (eventos `join`, `message`, `typing`; servidor emite `joined`, `message`, `typing`, `presence`) |
| ABNT          | `POST /api/abnt/convert` (upload .docx/.pdf/.txt → texto extraído), `GET/POST /api/abnt/references`, `DELETE /api/abnt/references/:id`, `POST /api/abnt/export` (download .docx ABNT) |
| Avisos        | `GET/POST /api/notices` |
| Trabalhos     | `GET/POST /api/assignments`, `DELETE /api/assignments/:id`, `GET /api/assignments/:id/submissions`, `PATCH /api/assignments/submissions/:id`, `POST /api/assignments/:id/submit` |
| Presença      | `GET/POST /api/attendance/sessions|open`, `PATCH /api/attendance/sessions/:id/close`, `POST /api/attendance/mark`, `GET /api/attendance/mine` |
| Fórum         | `GET/POST /api/forum`, `POST /api/forum/:id/replies` |
| Salas         | `GET/POST /api/rooms`, `GET/POST /api/rooms/:id/posts` |
| Notificações  | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications`, `DELETE /api/notifications/:id`, `POST /api/notifications/subscribe` |
| Progresso     | `GET /api/progress` |
| Estatísticas  | `GET /api/stats` |
| Health        | `GET /api/health` |

## Build de produção

```bash
# Frontend: gera frontend/dist (estático, servir com nginx/Vercel/etc.)
cd frontend
npm run build

# Backend: compila para backend/dist
cd backend
npm run build
npm start
```

### Checklist de produção

1. **Frontend**: defina `VITE_API_URL` apontando para a URL pública da API antes do `npm run build` (o valor fica embutido no bundle).
2. **Backend**: defina `JWT_SECRET` forte (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) e `CLIENT_URL` com a origem real do frontend (usado no CORS).
3. **Banco**: crie o schema com `npm run db:init` ou aplique `database/schema.sql` manualmente.
4. **Uploads**: o backend grava arquivos em `backend/uploads/` — em produção, monte volume persistente ou configure storage externo.
5. **HTTPS**: obrigatório para notificações do navegador (Push/Notification API exigem contexto seguro).

## Estrutura

```
backend/src/routes/    # rotas da API (auth, subjects, materials, events, ...)
backend/src/lib/       # pool de conexão (db) e helper de notificações (notify)
backend/src/middleware/ # autenticação JWT + guard de role
database/              # schema.sql + seed.sql
frontend/src/pages/    # páginas React (Dashboard, Disciplinas, Agenda, ...)
frontend/src/components/ # UI (Calendar, Toast, ConfirmDialog, NotificationsMenu, ...)
frontend/src/lib/      # cliente axios com token, contexto de auth, PWA, cores
```

---

> **Manutenção**: sempre que uma funcionalidade for adicionada, alterada ou removida, atualize a seção "Funcionalidades" deste README no mesmo commit.
