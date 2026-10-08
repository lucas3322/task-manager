# Changelog

Todas as mudanças relevantes do Orbitask serão registradas aqui.

## 0.5.0 — 2026-10-08

- feat(desktop): aviso de nova versão com download e instalação no app
- feat(desktop): buscar e instalar atualizações em Ajustes › Sobre
- build: npm run release faz versão, commit, tag e push

## 0.4.0 — 2026-10-08

### Novidades

- Nova interface compartilhada (`@orbitask/ui`) usada pela Web e pelo Desktop, com tema claro/escuro, cor de destaque e material translúcido.
- Landing page reescrita com mockups do produto, visualizações interativas, segurança e perguntas frequentes.
- Início com foco do dia e nova tela Minhas tarefas (endpoint `GET /me/tasks`) em todos os projetos.
- Ajustes de perfil, troca de senha, encerramento de outras sessões, renomear workspace e preferências de aparência.
- Exclusão de projetos, lixeira com restauração e “Desfazer” ao excluir tarefas.
- Paleta de comandos (⌘K), atalhos de teclado e rotas no endereço (voltar/avançar funcionam).
- Calendário com arrastar para reagendar e cronograma com marcador de hoje.

### Alterações

- Todos os menus e botões passam a executar ações reais; itens sem função foram removidos.
- Dados sincronizam sozinhos ao voltar para a janela e a cada 20 s.
- Notificações específicas: atribuição, mudança de status e de prazo; reordenações não notificam mais.
- `pnpm dev:api` compila com `tsc --watch` (o `tsx` não emitia metadados de decorators e a injeção de dependências falhava).

### Correções

- Status inválido em uma tarefa retornava erro 500; prioridade inexistente era aceita.
- Prazo anterior à data de início era aceito quando só o prazo era alterado.
- Anexos aceitavam links `javascript:`; agora apenas http(s).
- Links de convite apontavam para `localhost` em produção sem `PUBLIC_APP_URL`.
- Datas podiam deslocar um dia conforme o fuso do servidor.
- Banco: remoção do projeto órfão criado pelo seed antigo, correção de prioridades órfãs e novas restrições de integridade.

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
