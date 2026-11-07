---
project: INVESTMENT CONTROL
module: fundacao
audience: [tecnica]
status: draft
---

# RN-001 — Fundação técnica

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

Primeira entrega do módulo: cria o esqueleto da aplicação Next.js (App Router) na Vercel, a conexão Prisma com o Neon, o núcleo transversal de erro/validação/log e a camada de provedores com contrato por capacidade. Também materializa os dados de referência (classes e segmentos) que as features seguintes consomem. Nenhuma regra financeira é implementada aqui — apenas a infraestrutura que permite implementá-las sem retrabalho.

Restrições de arquitetura: o domínio não pode importar `next/*`, `@prisma/client` nem SDK de provedor (ADR-004); dinheiro é `Decimal` (ADR-006); toda integração passa pelo backend (RN-001); segredos só em variáveis de ambiente (RN-068).

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-001 | ProjetoInvest | Middleware/guard de integração — nenhuma rota de UI |
| RN-003 | ProjetoInvest | `DadoProveniente` usado por todos os endpoints de mercado |
| RN-008 | ProjetoInvest | Formatação global (BRL/PT-BR) |
| RN-068 | ProjetoInvest | Configuração de ambiente e `.env.example` |
| RN-069 | ProjetoInvest | Validação Zod transversal |
| RN-072 | ProjetoInvest | Camada de erro de integração |
| RN-073 | ProjetoInvest | Estratégia de fallback para histórico local |
| RN-074 | ProjetoInvest | `log_integracao` |
| RN-083 | ProjetoInvest | Escopo de release (não implementa fases 2–5) |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Monolito modular Next.js com Route Handlers (ADR-001) | Um deploy, tipos compartilhados, menor custo operacional |
| 2 | Prisma com `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations) | Compatibilidade com Neon serverless |
| 3 | Erro de domínio como `Result<T, E>` com código tipado | Evita exceção como fluxo e permite mapear HTTP na borda |
| 4 | `requestId` por requisição, propagado ao log e ao erro | Rastreabilidade sem expor detalhe interno |
| 5 | Provedores resolvidos por capacidade e prioridade em banco | Troca de fonte sem deploy (RN-002, RN-030, RN-034) |
| 6 | Dados de referência (classes/segmentos) em migration + seed idempotente | Garante ambiente reproduzível |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §1 (convenções, envelope de erro, `DadoProveniente`), §13 (`/api/health`)
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.2 (`classe_ativo`), §4.3 (`segmento_ativo`), §4.16 (`provedor_dados`), §4.17 (`log_integracao`), §7 (seeds)
- **UI:** `specs/UI_SPEC.md` §1 (formatação e tokens), sem tela própria
- **Arquitetura:** `specs/ARCHITECTURE.md` §3–§11
- **Legado:** não aplicável (greenfield)

## Riscos e pré-requisitos

- `DATABASE_URL`/`DIRECT_URL` e `AUTH_SECRET` precisam existir antes do primeiro deploy.
- Definir provedor de e-mail não é pré-requisito desta feature, mas é da RN-085.
- A migration inicial não pode incluir tabelas de features seguintes — risco de conflito de migration.
- Regra de lint de dependência (`no-restricted-imports`) deve entrar aqui, não depois: é mais barato impedir do que corrigir.
- `prisma migrate deploy` no build da Vercel precisa ser idempotente e não pode rodar em preview com banco de produção.
