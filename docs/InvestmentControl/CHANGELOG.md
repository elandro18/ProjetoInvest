# Histórico de Mudanças

## 07/11/2026 — Abertura do módulo InvestmentControl

### Adicionado

- `PROJECT_CHARTER.md`: termo de abertura derivado de `docs/expecificaçoes.md`, com 7 riscos iniciais e `compliance: true`.
- `REQUIREMENTS.md`: 84 regras de negócio (RN-001 a RN-084), 15 pendências (PEND-001 a PEND-015), 17 entidades em §6 (6.1–6.13) e matriz de rastreabilidade por épico.
- `DECISIONS.md`: ADR-001 a ADR-010 (stack, banco, autenticação, camadas, provedores, decimal, proveniência, configuração, escopo da Fase 1, testes).
- `specs/ARCHITECTURE.md`: visão de containers, camadas, mapa de módulos, fluxo de integração e estratégia de cache.
- `specs/DATA_MODEL.md`: modelo relacional com 18 tabelas (17 da especificação + `limite_concentracao`), enums, chaves, índices e regras de integridade.
- `quality/TRACEABILITY.md`: matriz RN → downstream com cobertura por artefato e portão de cobertura em aberto.
- `docs/CONSTITUTION.md` e `docs/INDEX.md`: governança e manifesto de navegação do repositório de documentação.
- `meetings/2026-11-07-01.md`: checkpoint de intake com premissas e perguntas em aberto.

### Alterado

- Nada (primeira versão).

### Removido

- Nada.

## 07/11/2026 — Fechamento da tradução técnica e decisão de conta

### Adicionado

- `RN-085` a `RN-088`: cadastro aberto com verificação de e-mail, redefinição de senha por token, aceite legal versionado e encerramento de conta com anonimização. `RN-085` promovida de `PEND-002` (IMP-094).
- `PEND-016`: designação do encarregado (DPO) e canal de atendimento ao titular (LGPD art. 41).
- `DECISIONS.md`: ADR-011 (cadastro aberto com verificação e consentimento versionado); ADR-003 atualizado de "Proposto" para "Aceito".
- `specs/API_CONTRACTS.md`: convenções, tipos comuns, 46 endpoints por fase, matriz endpoint → RN.
- `specs/ERROR_CATALOG.md`: 66 códigos de erro com HTTP, mensagem, causa, ação e RN.
- `specs/UI_SPEC.md`: princípios, mapa de navegação, 20 telas, componentes transversais, estados, acessibilidade e responsividade.
- `specs/SECURITY.md`: ativos, STRIDE, autenticação, autorização, validação, cabeçalhos, supply chain, auditoria e checklist de liberação.
- `specs/COMPLIANCE.md`: inventário de dados pessoais e checklist LGPD de 10 eixos com status e pendências bloqueantes.
- `quality/ACCEPTANCE_CRITERIA.md`: 96 critérios Dado-Quando-Então (88 RNs + 8 eventos críticos).
- `quality/TEST_STRATEGY.md`: pirâmide, gates de cobertura, 15 casos de ouro, fixtures e pipeline.
- `quality/DEFINITION_OF_DONE.md`: DoD de task, feature e release da Fase 1.
- `meetings/2026-11-07-02.md`: checkpoint da decisão de cadastro aberto e do fechamento da tradução.

### Alterado

- `REQUIREMENTS.md`: §2 ganhou o ator "Visitante"; §4 ganhou Conta, Token de conta e Aceite legal; §5.14 criado; §6.14 e §6.15 criados; §9, §10 e Anexo A atualizados.
- `specs/DATA_MODEL.md`: `usuario.status_conta` e `email_verificado_em`; tabelas `token_conta` e `aceite_legal` (20 tabelas no total); novos enums.
- `specs/ARCHITECTURE.md`: §7 reescrito para cadastro aberto com verificação; variáveis `EMAIL_SERVER`/`EMAIL_FROM`; rotas públicas de conta.
- `quality/TRACEABILITY.md`: matriz estendida a 88 RNs e cobertura por artefato atualizada.

### Removido

- Nada.

## 07/11/2026 — Features e tasks da Fase 1

### Adicionado

- `RN-089`: base de cálculo do percentual por segmento = patrimônio total; "Caixa e Oportunidades" é segmento da carteira. `RN-089` promovida de `PEND-011` (IMP-094).
- `RN-090`: tolerância de 0,5 ponto percentual para classificar "dentro da meta".
- `RN-091`: ativo sem cotação é avaliado pelo custo e marcado como "valor indisponível".
- `analysis/` — 8 pastas de análise (Funcional + Técnica pura, IMP-092): RN-001, RN-085, RN-010, RN-014, RN-057, RN-021, RN-020, RN-061.
- `delivery/fase-1/` — 8 arquivos `RN-NNN — <título> — Feature.md` (IMP-093) com 46 tasks no total:
  - RN-001 Fundação técnica — 6 tasks
  - RN-085 Conta e autenticação — 9 tasks
  - RN-010 Cadastro de ativos — 6 tasks
  - RN-014 Movimentações e posição — 6 tasks
  - RN-057 Renda fixa — 5 tasks
  - RN-021 Metas de alocação — 5 tasks
  - RN-020 Carteira consolidada — 4 tasks
  - RN-061 Dashboard — 5 tasks
- `meetings/2026-11-07-03.md`: checkpoint da decisão de `PEND-011` e da geração das features.

### Alterado

- `docs/CONSTITUTION.md` §11: `delivery_style` alterado de `epic` para `release` — as features são agrupadas por fase (`fase-1`, `fase-2`, ...), conforme a §14 do documento de especificação.
- `DECISIONS.md`: ADR-001 (stack Next.js) alterado de "Proposto" para "Aceito" pelo proprietário em 07/11/2026.
- `REQUIREMENTS.md`: `RN-023` passa a referenciar `RN-089`; `PEND-011` marcada como promovida; total de 91 RNs e 16 PENDs.
- `specs/API_CONTRACTS.md` §7.3: `baseCalculo` de segmento fixado em `PATRIMONIO_TOTAL` (RN-089).
- `specs/API_CONTRACTS.md` §5.1 e `specs/UI_SPEC.md` §5: marcação `valorIndisponivel` e avaliação pelo custo (RN-091).
- `quality/ACCEPTANCE_CRITERIA.md`: `AC-089`, `AC-090` e `AC-091` adicionados (99 critérios).
- `quality/TRACEABILITY.md`: escopo estendido a 91 RNs; cobertura de entrega = 52 de 91.

### Removido

- Nada.

## 07/11/2026 — Glossários, guias de uso e acordo de escopo

### Adicionado

- `glossaries/DEV_GLOSSARY.md`: 23 termos técnicos com classificação DDD, relações e desambiguação.
- `glossaries/BUSINESS_GLOSSARY.md`: 30 termos em linguagem de negócio (PT-BR, sem jargão técnico).
- `glossaries/USER_GLOSSARY.md`: 18 termos em linguagem coloquial para o usuário final.
- `docs/howto/cadastrar-ativo.md`: passo a passo, dicas e erros comuns do cadastro de ativos.
- `docs/howto/registrar-movimentacao.md`: passo a passo, tipos, conferência do valor total e erros comuns.
- `docs/howto/configurar-metas.md`: passo a passo das metas por classe e por segmento e leitura do desvio.
- `delivery/SCOPE_AGREEMENT.md`: acordo de escopo em linguagem de negócio — 20 regras confirmadas, 14 pendências e 4 riscos de negócio.

### Alterado

- Nenhum artefato existente foi alterado.

### Removido

- Nada.

## 08/11/2026 — Fundação implementada (RN-001-1 a RN-001-3)

### Implementado (código, branch `feature/rn-001-fundacao-tecnica`)

- **RN-001-1** — scaffold Next.js 15.5.29 + TypeScript + App Router + Tailwind 4, estrutura de camadas, scripts, `.env.example`, `.gitignore`, regra de dependência do ADR-004 no ESLint, README em PT-BR. `lint`, `typecheck` e `build` verdes.
- **RN-001-2** — Prisma 6.19.3 + `@prisma/client` + `tsx`; migrations `init` (`classe_ativo`, `segmento_ativo`) e `fn_atualizado_em`; seed idempotente com 2 classes e 9 segmentos. Banco local em Docker.
- **RN-001-3** — `Result`, `AppError` + catálogo, `Decimal`/`Money` (decimal.js), envelope de erro, `withRoute` com `requestId`, validação Zod por campo, logger com mascaramento e `GET /api/health`.

### Adicionado (documentação)

- `delivery/fase-1/RN-001 — Fundação técnica — Feature.md`: task **RN-001-7** `[Database] Criar tabelas provedor_dados e log_integracao` — separação de banco e código exigida pela regra de escopo único; ondas de execução ajustadas (RN-001-7 antes da RN-001-4).

### Alterado (documentação)

- `specs/ARCHITECTURE.md` §3: regra de dependência refinada — `app/api/**` (Route Handlers) pode importar `src/infra/http/**` e o composition root; páginas e componentes continuam proibidos de importar `src/infra/**`. Correção motivada por divergência reportada na implementação da RN-001-3.

### Observações operacionais

- A porta 5432 da máquina está ocupada por um PostgreSQL nativo; o container de desenvolvimento publica em **5433** (`docker-compose.dev.yml`, `.env` e README alinhados).
- `package.json#prisma` está deprecado no Prisma 6.19 — migrar para `prisma.config.ts` antes do Prisma 7.

### Removido

- Nada.
