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

## 08/11/2026 — Fundação implementada (RN-001-1 a RN-001-4 e RN-001-7)

### Implementado (código, branch `feature/rn-001-fundacao-tecnica`)

- **RN-001-1** — scaffold Next.js (15.5.29 na época, depois 16.4.5) + TypeScript + App Router + Tailwind 4, estrutura de camadas, scripts, `.env.example`, `.gitignore`, regra de dependência do ADR-004 no ESLint, README em PT-BR.
- **RN-001-2** — Prisma 6.19.3 + `@prisma/client` + `tsx`; migrations `init` (`classe_ativo`, `segmento_ativo`) e `fn_atualizado_em`; seed idempotente com 2 classes e 9 segmentos. Banco local em Docker.
- **RN-001-3** — `Result`, `AppError` + catálogo, `Decimal`/`Money` (decimal.js), envelope de erro, `withRoute` com `requestId`, validação Zod por campo, logger com mascaramento e `GET /api/health`.
- **RN-001-7** — tabelas `provedor_dados` e `log_integracao` + seed do provedor CVM.
- **RN-001-4** — port de provedor, `DadoProveniente`, registry por capacidade/prioridade, http-client com timeout e retry, log de integração sanitizado e stub.

### Adicionado (documentação)

- `delivery/fase-1/RN-001 — Fundação técnica — Feature.md`: task **RN-001-7** `[Database] Criar tabelas provedor_dados e log_integracao` — separação de banco e código exigida pela regra de escopo único; ondas de execução ajustadas (RN-001-7 antes da RN-001-4).

### Alterado (documentação)

- `specs/ARCHITECTURE.md` §3: regra de dependência refinada — `app/api/**` (Route Handlers) pode importar `src/infra/http/**` e o composition root; páginas e componentes continuam proibidos de importar `src/infra/**`. Correção motivada por divergência reportada na implementação da RN-001-3.

### Observações operacionais

- A porta 5432 da máquina está ocupada por um PostgreSQL nativo; o container de desenvolvimento publica em **5433** (`docker-compose.dev.yml`, `.env` e README alinhados).
- `package.json#prisma` está deprecado no Prisma 6.19 — migrar para `prisma.config.ts` antes do Prisma 7.

### Removido

- Nada.

## 08/11/2026 — Fundação: testes, CI e atualização de dependências (RN-001-6)

### Adicionado

- `vitest.config.ts` e `vitest.setup.ts`: projetos `node` e `ui`, gates de cobertura (global 75% linhas; `src/modules/**` 90% linhas / 85% branches).
- 14 arquivos de teste — **206 testes** cobrindo `Result`, `AppError`, `Decimal`/`Money`, envelope de erro, validação Zod, `withRoute`, logger, registry, http-client, log e stub.
- `playwright.config.ts` + `e2e/home.spec.ts` e `e2e/health.spec.ts`.
- `.github/workflows/ci.yml`: job de qualidade (lint, typecheck, cobertura, build, audit) e job de E2E (Chromium).
- `scripts/audit.mjs` + script `npm run audit`: auditoria com allowlist explícita e rastreável.
- `DECISIONS.md` ADR-012: aceite temporário da advisory GHSA-ggr8-5vv4-36mx (deepmerge-ts via Prisma 6), com prazo de revisão.

### Alterado

- Dependências: **Next 15.5.29 → 16.4.5**, `eslint-config-next` 16, **Vitest 3.2.7 → 5.1.0**, `@vitest/coverage-v8` 5, `@types/node` 20 → 22. O upgrade eliminou as vulnerabilidades críticas (Vitest) e as altas de `postcss` (Next).
- `eslint.config.mjs`: migrado de `FlatCompat` para os exports flat do `eslint-config-next` 16, preservando a regra do ADR-004.
- CI: etapa de auditoria passou a usar `npm run audit` (allowlist documentada) em vez de `npm audit` puro.

### Resultado das verificações

- `npm run test` — 206 testes verdes.
- Cobertura — 96,59% de linhas global; `src/modules/**` 100% linhas e branches.
- `npm run test:e2e` — 2 testes verdes em Chromium.
- `npm run lint`, `npm run typecheck`, `npm run build` — verdes.
- `npm run audit` — 1 aceite explícito (ADR-012), 0 bloqueios.

### Removido

- Nada.

## 08/11/2026 — Conta e autenticação implementadas (RN-085)

### Implementado (código)

- **RN-085-1** — tabelas `usuario`, `token_conta`, `aceite_legal`; índice único `lower(email)`; trigger de `atualizado_em`.
- **RN-085-2** — cadastro aberto com Argon2id, aceite legal versionado, hash de IP e token de verificação de 24 h.
- **RN-085-3** — verificação de e-mail e reenvio neutro com rate limit.
- **RN-085-4** — Auth.js v5 (5.0.0-beta.32), JWT de 8 h, `sessionVersion`, `requireUsuario()` e middleware de proteção.
- **RN-085-5** — esqueci-senha/redefinir-senha com token de 1 h, uso único e invalidação de sessões.
- **RN-085-6** — `DELETE /api/conta` com anonimização determinística, remoção de tokens e preservação do aceite legal.
- **RN-085-7** — telas públicas de login, cadastro, verificação, esqueci-senha e redefinir-senha.
- **RN-085-8** — shell privado, `/conta` e diálogo de encerramento com confirmação por senha.
- **RN-085-9** — 397 testes, E2E 8/8, cobertura global 86,56% e domínio 100%.

### Corrigido (segurança)

- Conta `SUSPENSA` podia ser reativada pela verificação de e-mail: `classificarTokenDeUso` passou a bloquear com `AUTH_CONTA_SUSPENSA` (403) e a ativação passou a exigir transição atômica de `PENDENTE_VERIFICACAO` para `ATIVA` na mesma transação do consumo do token.

### Decisões e pendências

- Mailer por port: console em desenvolvimento, SMTP quando `EMAIL_SERVER`/`EMAIL_FROM` existem.
- Pendências: páginas `/termos` e `/privacidade`; E2E de verificação/reset depende de provedor de e-mail; job E2E do CI sem Postgres (teste de login é auto-skipado); IDOR de recurso de negócio será exercitado na RN-010; aviso do Next 16 sobre `middleware` → `proxy`.

### Removido

- Nada.

## 08/11/2026 — Cadastro de ativos implementado (RN-010)

### Implementado (código)

- **RN-010-1** — tabela `ativo` com unicidade `(usuario_id, ticker)`, CHECK de ticker e trigger de `atualizado_em`.
- **RN-010-2** — `GET/POST /api/ativos` com busca, filtros, paginação e validação de classe/segmento/CNPJ.
- **RN-010-3** — `GET/PATCH /api/ativos/{id}` com imutabilidade de `ticker`/`classeId` e inativação por status.
- **RN-010-4** — listagem com busca, filtros, tabela/cartões e formulário com selects dependentes e máscara de CNPJ.
- **RN-010-5** — ficha com abas, edição de campos permitidos e inativar/reativar com confirmação.
- **RN-010-7** — `GET /api/referencia/ativos` com classes e segmentos aninhados (alimenta o formulário e a futura tela de metas).
- **RN-010-6** — 17 cenários E2E (CRUD, filtros, ficha, mobile e isolamento A/B entre usuários).

### Resultado das verificações

- 457 testes unitários/integração + 17 E2E verdes.
- Cobertura: 85,98% de linhas global; `src/modules/**` 100% linhas e branches.
- `lint`, `typecheck`, `build` verdes.

### Pendências

- `fonteDados` é texto livre: a validação contra `provedor_dados` (contrato §3.2) fica para quando houver endpoint de provedores.
- `posicao`, `rendimentosAcumulados` e `ultimosPrecos` são placeholders contratuais até RN-014/RN-017/RN-030.
- Ficha externa é placeholder até a Fase 3 (RN-029/RN-035).
- Cadastro cria sempre `ATIVO` (o contrato não aceita `status` no POST).

### Removido

- Nada.

## 09/11/2026 — Movimentações e posição: banco, domínio, API e telas (RN-014)

### Implementado (código)

- **RN-014-1** — tabelas `movimentacao`, `posicao_ativo` e `rendimento`, com enums, CHECKs, índice parcial de idempotência e FKs.
- **RN-014-2** — domínio puro de posição: compra, venda com baixa proporcional, reconstrução ordenada por `(data, criadoEm)`, validação de total (tolerância R$ 0,01) e estratégia de baixa isolada (custo médio).
- **RN-014-3** — `POST /api/movimentacoes` transacional com idempotência, criação de rendimento em dividendo/juros, confirmação explícita de posição negativa (auditada) e rejeição de `APLICACAO_RF`/`RESGATE_RF` até `PEND-017`.
- **RN-014-4** — `GET /api/movimentacoes` (filtros, paginação, `sort`) e cancelamento lógico com recálculo da posição.
- **RN-014-5** — tela `/movimentacoes` com lista, filtros, formulário com total em tempo real, diálogo de posição negativa e cancelamento com motivo.
- **RN-014-6** — 9 cenários E2E (compra, dividendo, venda confirmada, cancelamento, filtros, ordenação, 360 px, idempotência e isolamento A/B) e teardown FK-safe.

### Resultado das verificações

- Casos de ouro G1–G7 e G14 verdes.
- 630 testes + 34 E2E; cobertura global 85,69% e `src/modules/posicao` 100% linhas/branches.
- `lint`, `typecheck`, `build` verdes.
- Playwright serializado (`workers: 1`) para evitar colisão de dados entre specs que compartilham o mesmo titular.

### Documentação corrigida após divergência reportada

- `REQUIREMENTS.md`: criada `PEND-017` (vínculo das movimentações de renda fixa com `investimento_renda_fixa`).
- `specs/DATA_MODEL.md` §4.6: documentada a exceção de posição negativa — cache não armazena quantidade negativa, a linha é removida e a posição é derivada do razão.
- `specs/API_CONTRACTS.md` §4.1/§4.2: `sort=criadoEm` e comportamento da posição negativa na resposta.

### Pendências

- Concorrência: duas criações simultâneas do mesmo ativo podem recalcular sobre o mesmo snapshot; avaliar lock por `(usuario_id, ativo_id)` quando houver carga.
- Telas (RN-014-5) e E2E (RN-014-6) pendentes.

### Removido

- Nada.

## 09/11/2026 — Renda fixa implementada (RN-057)

### Implementado (código)

- **RN-057-1** — tabela `investimento_renda_fixa` com enums de produto/indexador/liquidez/status, CHECKs de taxa, valor, saldo e datas, índices e trigger.
- **RN-057-2** — `GET/POST /api/renda-fixa` e `PATCH /api/renda-fixa/{id}`; cobertura FGC derivada do produto; campos imutáveis após o cadastro.
- **RN-057-3** — `GET /api/renda-fixa/alertas` com vencimento próximo, carência, ausência de liquidez diária, concentração por instituição e limite de FGC (os dois últimos só com limite configurado).
- **RN-057-4** — tela `/renda-fixa` com lista, filtros, ordenação, formulário, diálogo de saldo e faixa de alertas.
- **RN-057-5** — 8 cenários E2E (CDB/Tesouro, FGC, saldo, alerta, filtro, ordenação/paginação, 360 px e isolamento A/B).

### Resultado das verificações

- 542 testes unitários/integração + 25 E2E verdes.
- Cobertura: 86,33% de linhas global; `src/modules/renda-fixa` 100% linhas e 99,39% branches.
- `lint`, `typecheck`, `build` verdes.

### Pendências

- `RF_CONCENTRACAO_MAXIMA_PERCENTUAL` e `RF_LIMITE_FGC` sem valor default (`PEND-004`/`PEND-012`): sem configuração, esses alertas não são gerados.
- "Hoje" dos alertas calculado em UTC — ajustar para `America/Sao_Paulo` se o produto exigir.
- Não existe `GET /api/renda-fixa/{id}` (o contrato não prevê detalhe); o `PATCH` devolve o recurso completo.
- Flake de timeout (5 s) no teste da ficha de ativo sob carga alta de workers — passa no rerun; workers locais reduzidos de 6 para 3.

### Removido

- Nada.

## 09/11/2026 — Metas de alocação implementadas (RN-021)

### Implementado (código)

- **RN-021-1** — tabela `alocacao_meta` com vigência e índices únicos parciais que garantem uma única configuração vigente por referência; defaults por usuário aplicados no primeiro acesso.
- **RN-021-2** — `GET/PUT /api/alocacao/metas` com validação de soma exata (100), referências ativas, histórico e encerramento da vigência anterior em transação.
- **RN-021-3** — `GET /api/alocacao/desvios` com base no patrimônio total (RN-089), tolerância de 0,5 p.p. (RN-090), valor para meta e marcação de custo quando não há cotação (RN-091). Port `ValorCarteira` isolado para reuso pela RN-020.
- **RN-021-4** — tela `/alocacao` com dois blocos de metas, soma em tempo real, confirmação de substituição e tabela de desvios.
- **RN-021-5** — 8 cenários E2E (defaults, vigência, somas inválidas, desvios com FII/RF, sem patrimônio, 360 px e isolamento A/B).

### Resultado das verificações

- 676 testes unitários/integração + 42 E2E verdes.
- Cobertura: 85,1% de linhas global; `src/modules/alocacao` 97,8% linhas / 90,6% branches.
- `lint`, `typecheck`, `build` verdes.

### Decisões

- Defaults de meta são **por usuário e lazy** (não há seed global possível), criados no primeiro `GET`.
- A meta da especificação que agrupa "Renda Urbana e Híbridos" em 15% foi dividida em **7,5 / 7,5**, porque são segmentos distintos no modelo.
- Vigência usa **índices únicos parciais** (`WHERE vigencia_fim IS NULL`) em vez de unicidade por data, garantindo uma única configuração vigente mesmo com duas substituições no mesmo dia.

### Pendências

- `GET /api/alocacao/desvios` antes de `GET /api/alocacao/metas` retorna 409 `ALO_METAS_AUSENTES` (defaults são lazy); a UI foi sequenciada para evitar o caso. Tornar o endpoint autossuficiente é candidato a CR.
- O campo `historico` agrupa substituições feitas no mesmo dia; as linhas ficam no banco, mas o período exibido colapsa.

### Removido

- Nada.
