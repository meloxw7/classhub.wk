# ClassHub

Portal acadêmico integrado: disciplinas, materiais, agenda com calendário, trabalhos, fórum, notificações e tutor IA (Gemini).

Stack: React 19 + Vite + Tailwind (frontend) · Express 5 + PostgreSQL (backend)

## Funcionalidades

### Autenticação e segurança
- Login com e-mail/senha (JWT, expira em 2h; senha com hash bcrypt)
- **Cadastro self-service** (`/cadastro`): alunos informam curso, semestre/período e matrícula (RA); professores informam **código da instituição** — a instituição é identificada automaticamente pelo código e exibida no perfil do professor. Códigos válidos: `NASSAU14` (Uninassau Boa Viagem), `CZC14` (Colégio Zuleide Constantino), `CSL` (Colégio Souza Leão), `UNB14` (Unibra Faculdade). Outros códigos via `INSTITUTION_CODES=CODE:Nome;...` — e a **disciplina que lecionam** (criada automaticamente)
- **Lembrar de mim** no login: sessão de 30 dias (marcado) ou 1 dia (desmarcado), via validade do refresh token
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
- Painel "Tarefas por disciplina" com **gráfico de barras** (proporcional ao total)
- Painel "Próximas provas" (4 primeiras) — respeita a visibilidade: cada usuário vê só as marcações destinadas a si
- Skeletons de carregamento e estados vazios em todos os painéis

### Busca global
- Página "Busca" (`/busca`) com resultados instantâneos (debounce de 400ms, mínimo 2 caracteres)
- Pesquisa em materiais (título, descrição, tags), eventos da agenda (respeitando a visibilidade de destinatários), perguntas do fórum e avisos — até 5 por área
- Atalho na sidebar; resultados linkam para a página correspondente

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

### Tutor IA (Gemini)
- Página "Tutor IA" (`/tutor`) com chat em **streaming** (resposta aparece palavra por palavra)
- Tutor com **contexto**: conhece o nome, o perfil (aluno/professor) e as disciplinas do ambiente do usuário logado
- Respostas didáticas em PT-BR com **markdown** (negrito, listas, blocos de código)
- Sugestões rápidas iniciais (explique um tópico, plano de estudos, simule uma prova, revise um texto)
- Botão **parar geração** durante o streaming e **copiar resposta** ao final
- **Anexos**: envie até 3 arquivos por mensagem (.pdf, .png, .jpg, .txt, .md — até 10 MB cada; .docx é lido como texto) — PDFs e imagens vão direto ao Gemini (multimodal), textos são anexados ao prompt
- **Exportar PDF**: qualquer resposta do tutor abre uma janela de impressão formatada (margem A4, cabeçalho ClassHub, listas e código estilizados) — "Salvar como PDF" do navegador gera o documento
- Histórico apenas na sessão (não persiste); sem dependências novas (REST + SSE via `fetch`)
- Configuração: `AI_API_KEY` (Google Gemini, gere em aistudio.google.com) + `AI_MODEL` (padrão `gemini-3.8-flash`) no `.env` do backend; sem chave, a rota responde 503
- A chave **nunca** vai ao frontend — o backend faz o proxy server-side

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

- Atalhos rápidos: publicar material, gerenciar trabalhos
- Formulário de publicação de aviso (com opção de fixar)

### Boletim (desempenho)
- Página "Boletim" (`/boletim`) com visões distintas:
  - **Aluno**: média geral (0–10), progresso de materiais, pendentes/atrasados e lista de trabalhos com status (`PENDING`/`SUBMITTED`/`GRADED`/`LATE`)
  - **Professor**: matriz alunos × disciplinas com média e entregas
- **Exportar CSV** (professor): boletim completo da turma (aluno, disciplina, entregas, corrigidas e média)

### UX / PWA
- **Modo escuro**: botão no topo (sol/lua), persiste por usuário no `localStorage`, aplicado antes do React montar (sem flash); utilitárias (.card, .input, botões) adaptadas
- PWA: manifest + service worker em produção (cache offline); em dev o SW é desregistrado para evitar cache velho
- Toasts de sucesso/erro em todas as ações
- Diálogos de confirmação para ações destrutivas
- ErrorBoundary global (tela de erro amigável)
- Skeletons de carregamento e estados vazios ilustrados
- Layout responsivo: sidebar fixa no desktop, drawer no mobile
- Cores determinísticas por disciplina (iniciais) e tons por progresso

### Infra da API
- `GET /api/health` para health check (isento de rate limit)
- Documentação interativa da API (Swagger UI) em `GET /api/docs`; spec OpenAPI 3.0 em `GET /api/docs/openapi.json`
- Uploads servidos estaticamente em `/uploads` (nome de arquivo sanitizado)
- Erros de upload padronizados (limite de 50 MB)
- **Rate limit em duas camadas**: global na `/api` (240 req/min por IP, configurável via `API_RATE_LIMIT`) + 30/min no `/api/auth`
- **Logs estruturados** com pino (JSON em produção, pino-pretty em dev; nível via `LOG_LEVEL`)
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

## Contas demo (apenas desenvolvimento)

Criadas pelo `seed.sql` para testes locais — em produção, use o cadastro self-service:

| Perfil    | E-mail                    | Senha  |
|-----------|---------------------------|--------|
| Aluno     | aluno@classhub.local      | 123456 |
| Professor | professor@classhub.local  | 123456 |

## API (resumo de endpoints)

| Área          | Endpoints |
|---------------|-----------|
| Auth          | `POST /api/auth/login` (aceita `rememberMe`), `POST /api/auth/register` |
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
| Fórum         | `GET/POST /api/forum`, `POST /api/forum/:id/replies` |
| Salas         | `GET/POST /api/rooms`, `GET/POST /api/rooms/:id/posts` |
| Notificações  | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications`, `DELETE /api/notifications/:id`, `POST /api/notifications/subscribe` |
| Progresso     | `GET /api/progress` |
| Estatísticas  | `GET /api/stats` |
| Busca         | `GET /api/search?q=` (materiais, eventos, fórum, avisos — respeita visibilidade) |
| CSV           | `GET /api/grades/export` (boletim da turma, professor) |
| Tutor IA      | `POST /api/tutor/chat` (streaming SSE; requer `AI_API_KEY`) |
| Health        | `GET /api/health` |
| Docs          | `GET /api/docs` (Swagger UI), `GET /api/docs/openapi.json` (spec OpenAPI 3.0) |

## Testes

Backend e frontend usam **Vitest**. Os testes do backend são de dois tipos:

- **Unitários** (sem banco): helpers de token, `getJwtSecret` e middleware de autenticação/role.
- **Integração** (precisam de PostgreSQL): health check, login/refresh/logout/reset com as contas demo, guard de autenticação (401), guard de role (403), rate limit do `/api/auth`, Swagger e **fluxos completos de negócio** — agenda com visibilidade, materiais com versões e progresso, avisos fixados, fórum com resposta oficial, salas de estudo, trabalhos com entrega/correção/boletim, notificações, estatísticas e conversor ABNT (convert + export .docx + referências). Sem `DATABASE_URL` configurada, os testes de banco são pulados automaticamente (`describe.skipIf`).

Cada teste de integração cria os próprios dados em uma disciplina sandbox e limpa tudo ao final (delete em cascata + revogação dos refresh tokens criados); os testes de senha/avatar **restauram o estado original** das contas demo.

```bash
cd backend   && npm test              # 76 testes (unit + integração)
cd frontend  && npm test              # 24 testes (colors, api/interceptor, Toast, ConfirmDialog)
```

Cobertura (`npm run test:coverage`): ~73% de linhas no backend e ~66% no frontend. `npm run test:watch` roda em modo watch.

### Hooks de commit (husky)

O repositório usa husky: a cada commit o `.husky/pre-commit` roda o lint dos dois pacotes (rápido); typecheck, testes e build rodam no CI.

## Docker

Suba a stack completa (Postgres + API + frontend) com um comando, do diretório `classhub_work`:

```bash
docker compose up --build
# App:   http://localhost:8080
# API:   http://localhost:4000/api
# Docs:  http://localhost:4000/api/docs
```

- Na **primeira** inicialização o Postgres aplica `database/schema.sql` + `seed.sql` automaticamente (contas demo incluídas); em reinicializações o volume `pgdata` é reaproveitado.
- Uploads persistem no volume `uploads`.
- O frontend é servido por nginx com proxy de `/api` e `/uploads` para o backend (sem CORS, chamadas same-origin).
- Produção: defina `JWT_SECRET` forte antes do `docker compose up` (ex.: `JWT_SECRET=$(openssl rand -hex 32) docker compose up -d`) e, se servir o frontend fora do nginx incluído, ajuste `CLIENT_URL`.

## CI (GitHub Actions)

`.github/workflows/ci.yml` roda a cada push/pull request, em dois jobs paralelos:

- **backend**: `npm run check` + `lint` + `db:init` (Postgres 16 como service) + `npm test` (integração inclusa) + `build`.
- **frontend**: `npm run check` + `lint` + `npm test` + `build`.

## Deploy (Render + Vercel)

Configuração pronta no repo — só precisa criar as contas e apontar.

### API + PostgreSQL (Render)

1. Em https://render.com → **New → Blueprint** → aponte para o repositório (raiz). O `render.yaml` cria:
   - Postgres `classhub-db` (free) com database/user `classhub`;
   - Web service `classhub-api` via `backend/Dockerfile` (build + produção), health check em `/api/health`.
2. Ao pedir o valor de `CLIENT_URL`, informe a URL do frontend do passo seguinte (ex: `https://classhub.vercel.app`).
3. No primeiro boot a API aplica `database/schema.sql` + `seed.sql` automaticamente (`db-init` é **idempotente** — pula se o schema já existe; contas demo já incluídas).
4. Anote a URL da API (ex: `https://classhub-api.onrender.com`).

### Frontend (Vercel)

1. Em https://vercel.com → **Add New → Project** → mesmo repositório, **Root Directory: `classhub_work/frontend`** (framework Vite detectado automaticamente).
2. Environment Variable: `VITE_API_URL` = `https://sua-api.onrender.com/api` (URL da API do Render + `/api`).
3. Deploy. O `vercel.json` cuida das rewrites de SPA.

### Observações de produção

- **HTTPS**: Vercel e Render entregam HTTPS — requisito para notificações Push do navegador.
- **Uploads**: no Render free o disco é efêmero — arquivos enviados somem a cada re deploy. Para persistência real, use o `docker-compose.yml` (VPS própria) ou migre uploads para storage externo.
- **SMTP / VAPID**: para recuperação de senha e push real em produção, preencha `SMTP_*` (Render: env vars do serviço) e gere chaves VAPID com `npm run vapid:gen` (backend).

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
backend/src/app.ts     # app Express (middlewares, rotas, error handler) — usado pelos testes
backend/src/server.ts  # servidor HTTP + WebSocket do chat + lembretes
database/              # schema.sql + seed.sql
frontend/src/pages/    # páginas React (Dashboard, Disciplinas, Agenda, ...)
frontend/src/components/ # UI (Calendar, Toast, ConfirmDialog, NotificationsMenu, ...)
frontend/src/lib/      # cliente axios com token, contexto de auth, PWA, cores
docker-compose.yml     # stack completa (Postgres + API + web)
backend/Dockerfile     # imagem da API (multi-stage)
frontend/Dockerfile    # build do frontend + nginx (SPA + proxy /api e /uploads)
.github/workflows/ci.yml # CI: check, lint, test e build nos dois lados
```

---

> **Manutenção**: sempre que uma funcionalidade for adicionada, alterada ou removida, atualize a seção "Funcionalidades" deste README no mesmo commit.
