---
project: INVESTMENT CONTROL
module: entrega
audience: [tecnica, negocio]
status: active
---

# Handover Log — Investment Control

> **Última atualização:** 10/11/2026
> **Branch:** `main` · **Base:** `main`
> **Estado:** Fases 1 e 2 implementadas e consolidadas na `main`.

---

## 1. Veredito

**Fases 1 e 2 implementadas** — 12 features concluídas (controle patrimonial, metas, dashboard, concentração, sugestão de aporte, simulador e histórico), com 925 testes, 69 E2E e cobertura global de 86,67%.

**Não está pronta para produção** por depender de: deploy (RN-001-5), provedor de e-mail real e páginas legais.

## 2. Como rodar

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres local na porta 5433
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

- Crie a conta em `/cadastro`; o link de verificação é impresso no console (mailer de desenvolvimento).
- Testes: `npm run test` · E2E: `npm run test:e2e` · cobertura: `npm run test:coverage` · auditoria: `npm run audit`.

> A porta 5432 desta máquina está ocupada por um PostgreSQL nativo; o container usa **5433**.

## 3. O que está pronto

| Feature | Escopo | Tasks |
|---|---|---|
| RN-001 | Fundação técnica (Next 16, Prisma, auth base, CI) | 7 (RN-001-5 pendente) |
| RN-085 | Conta, login, verificação, reset e encerramento | 9 |
| RN-010 | Cadastro de ativos e referência de classes/segmentos | 7 |
| RN-014 | Movimentações, posição e preço médio | 6 |
| RN-057 | Renda fixa com alertas | 5 |
| RN-021 | Metas de alocação, vigência e desvios | 5 |
| RN-020 | Carteira consolidada, evolução e posições | 5 |
| RN-061 | Dashboard, gráficos e oportunidades | 5 |

### Fase 2 — Planejamento de aportes

| Feature | Escopo | Tasks |
|---|---|---|
| RN-049 | Controle de concentração por ativo, gestora, segmento e emissor | 5 |
| RN-025 | Sugestão de aporte (water-filling), checklist e decisão | 7 |
| RN-028 | Simulador de aporte (antes/depois, stateless) | 3 |
| RN-052 | Histórico de sugestões e detalhe das decisões | 3 |

Rotas privadas: `/dashboard`, `/carteira`, `/ativos`, `/ativos/novo`, `/ativos/[id]`, `/movimentacoes`, `/renda-fixa`, `/alocacao`, `/aportes`, `/aportes/historico`, `/configuracoes`, `/conta`. Públicas: `/login`, `/cadastro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`.

## 4. Decisões que não devem ser desfeitas sem CR

- **Dinheiro é `Decimal` serializado como string** (ADR-006). Nenhum cálculo financeiro passa por `number`.
- **Domínio não importa framework/ORM/SDK** (ADR-004), garantido por regra de ESLint.
- **Posição é derivada do razão de movimentações**; `posicao_ativo` é cache, nunca fonte primária (RN-015).
- **Posição negativa confirmada**: a movimentação é gravada e auditada; o cache não persiste quantidade negativa (`DATA_MODEL` §4.6).
- **Sem cotação na Fase 1**: FII entra pelo custo com `valorIndisponivel` (RN-091); a evolução é a custo.
- **Metas são por usuário e lazy** (primeiro acesso), com vigência por índices únicos parciais.
- **Blocos do dashboard degradam isoladamente** e reportam em `erros[]`.
- **Auditoria de dependências** usa allowlist explícita (`scripts/audit.mjs` + ADR-012).
- **Limite de concentração não tem default** (`PEND-004`): sem configuração, o percentual é exibido e nenhum alerta é gerado.
- **Sugestão de aporte usa water-filling por gap sobre o patrimônio pós-aporte**: a classe mais distante recebe primeiro; nunca rateio igualitário.
- **Checklist trata ausência de dado como `INDISPONIVEL`, nunca como positivo** (RN-077): qualidade e preço só existem nas Fases 3/4.
- **Simulação de aporte é stateless**: não cria sugestão nem altera a carteira.
- **Histórico de sugestões é somente leitura**: a sugestão é fato; alteração exigiria CR.

## 5. Dívidas técnicas e pendências

| Item | Impacto | Onde |
|---|---|---|
| Deploy Vercel + Neon (RN-001-5) | bloqueia produção | feature RN-001 |
| Provedor de e-mail real (SMTP/API) | bloqueia verificação em produção | `src/infra/mailer` |
| `/termos` e `/privacidade` | bloqueia go-live conforme LGPD | `COMPLIANCE.md` C1 |
| Prisma 6 → 7 | remove a allowlist do audit | ADR-012 |
| `middleware.ts` → `proxy.ts` | aviso do Next 16 | raiz |
| Shell §2.1 (sidebar/barra inferior) | navegação no header | UI_SPEC |
| Lock por `(usuario_id, ativo_id)` | concorrência em criações simultâneas | RN-014 |
| `fonteDados` sem validação contra provedores | integridade do cadastro | API §3.2 |
| `Idempotency-Key` não exposta no `api-client` | retry idempotente pela UI | `src/lib/api-client.ts` |
| Filtro de status da carteira limitado a 100 ativos | UX com carteira grande | `carteira-ui.ts` |
| Middleware reemite `Set-Cookie` em prefetch do header | sessão "ressuscita" após logout (contornado no teste) | `middleware.ts` |
| `PEND-005`, `PEND-007`, `PEND-008`, `PEND-010`, `PEND-016`, `PEND-017` | decisões de negócio | `REQUIREMENTS.md` §11 |

## 6. Próximo passo acordado

**Fase 3 — Pesquisa de FIIs e provedores de dados** (RN-029 a RN-038): destrava cotação, histórico de preços e os itens hoje `INDISPONIVEL` no checklist da sugestão (dados suficientes e preço dentro dos parâmetros).

Antes ou em paralelo: fechar o deploy da Fase 1/2 e os documentos legais (`/termos`, `/privacidade`, DPO — `PEND-016`).

## 7. Guia de leitura

1. `PROJECT_CHARTER.md` — escopo e riscos.
2. `REQUIREMENTS.md` — 91 RNs, 17 PENDs.
3. `specs/ARCHITECTURE.md` e `specs/DATA_MODEL.md` — como o sistema é construído.
4. `delivery/fase-1/` — features e tasks executadas.
5. `quality/TEST_STRATEGY.md` e `TRACEABILITY.md` — como é verificado.
6. `CHANGELOG.md` — o que mudou, quando e por quê.
