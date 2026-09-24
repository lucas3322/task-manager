# Changelog

Todas as mudanças relevantes do Orbitask serão registradas aqui.

## Em desenvolvimento

- Próximas melhorias em planejamento.

## 0.3.0 — 2026-09-24

### Novidades

- Colaboração com membros, convidados, papéis e acesso restrito por projeto.
- Comentários, anexos, seguidores, responsáveis e caixa de entrada persistente.
- Subtarefas, checklists, dependências e campos personalizados.
- Calendário, cronograma, busca global, filtros avançados e filtros salvos.
- Automações por gatilhos de criação e mudança de status.
- Dashboard do workspace com progresso, atrasos, prioridades e carga da equipe.
- Portfólios e metas vinculados aos projetos, com saúde, prazo e progresso.
- Configuração completa de projetos, colunas, prioridades, tags, badges, cores e ícones.

### Alterações

- Paridade funcional entre aplicação Web e Desktop.
- Dados operacionais e preferências passam a ser persistidos na API PostgreSQL.
- Revisão visual de cards, menus, formulários, foco e estados interativos.

### Correções

- Cadastro e login do Desktop passam a usar corretamente as rotas públicas de autenticação.
- Subtarefas novas deixam de herdar incorretamente o status concluído.
- Menus e popovers fecham ao clicar fora ou pressionar Escape.
- Cores dos cards acompanham a coluna após movimentação por drag-and-drop.

## 0.1.0 — 2026-08-26

### Novidades

- Fundação do monorepo TypeScript.
- Aplicativo Electron local-first com SQLite e IPC seguro.
- Projetos e tarefas com visualizações Kanban e Lista.
- Landing page, página de downloads, central de novidades e acesso separado ao app web.
- Regras iniciais para workflows e dependências sem ciclos.
