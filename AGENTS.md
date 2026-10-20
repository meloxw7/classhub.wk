# AGENTS.md — Regras de trabalho no ClassHub

## Commits (instrução permanente do usuário)
- **Sempre commitar** absolutamente todas as alterações ao concluir cada tarefa/alteração verificada. Não deixar trabalho não commitado.
- **Mensagens explicadas**: subject curto (prefixo `feat:`/`fix:`/`chore:`/`docs:`, lowercase, pt-BR sem acentos) + body detalhando o que mudou, por quê e como foi verificado.
- Nunca commitar segredos (`.env` já ignorado), `dist/`, `coverage/`, `uploads/`.
- Nunca usar `git push`, amend, force-push ou PRs sem pedido explícito.

## Verificação obrigatória antes de cada commit
```bash
npm run lint                        # lint backend + frontend
npm --prefix classhub_work/backend run check   # tsc backend
npm --prefix classhub_work/frontend run check   # tsc frontend
```

## Estrutura
- `classhub_work/backend`  — Express + pg (src/routes, migrações idempotentes via `ensureSchema` em cada rota nova)
- `classhub_work/frontend` — React 19 + Vite (src/pages, src/components, src/lib)
- `classhub_work/database/schema.sql` — schema completo para instalações novas; rotas novas devem refletir suas tabelas aqui também
- Backend roda na porta 4000 (`node dist/server.js` ou `npm run dev`); frontend dev na 5173

## Convenções
- UI: classes utilitárias prontas (`card`, `btn-primary`, `input`, `chip`, `muted`, `section-title`), ícones lucide-react, pt-BR
- API: rotas Express com `auth` middleware, respostas JSON `{ message }` em erros, camelCase no mapeamento
- Testes de fumaça: scripts node em `%TEMP%\opencode` com usuários temporários + cleanup via DELETE cascade
