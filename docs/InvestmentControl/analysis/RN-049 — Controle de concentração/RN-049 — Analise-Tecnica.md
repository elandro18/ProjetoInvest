---
project: INVESTMENT CONTROL
module: risco
audience: [tecnica]
status: draft
---

# RN-049 — Controle de concentração

> Gerado por rdd-doc em 09/11/2026. Edite para revisar.

## Contexto técnico

Implementa o controle de concentração da carteira em cinco dimensões, com limites configuráveis por usuário e alertas calculados sob demanda. É pré-requisito do checklist de sugestão de aporte (RN-050), que verifica se um candidato aumenta a concentração.

A base de cálculo é o patrimônio total (RN-089). Sem cotação de mercado, FII entra pelo custo e RF pelo saldo (RN-091). A dimensão `IMOVEL` existe no modelo, mas fica indisponível até a ficha do FII (Fase 3/4) fornecer a exposição por imóvel/inquilino.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-049 | ProjetoInvest | `GET/PUT /api/configuracoes/limites`, `GET /api/risco/concentracao` |
| RN-082 | ProjetoInvest | Configuração em banco com vigência |
| RN-089 | ProjetoInvest | Base de cálculo = patrimônio total |
| RN-091 | ProjetoInvest | FII a custo, RF a saldo |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Limites em tabela própria com vigência | Mudança sem deploy e histórico preservado (ADR-008) |
| 2 | Cálculo sob demanda, sem persistir alerta | Evita inconsistência temporal; o dado deriva da carteira |
| 3 | Sem limite default | `PEND-004` não definido; inventar um limite seria pior que não alertar |
| 4 | Dimensões com `referencia` textual | Gestora/segmento/instituição são identificados por nome ou código |
| 5 | `IMOVEL` com `disponivel: false` | Transparência sobre o que ainda não é medido |
| 6 | Reuso do port de valores da carteira | Mesma base da alocação e da carteira |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §12 (`/api/configuracoes/limites`) e §12.1 (`/api/risco/concentracao` — a acrescentar)
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.18 (`limite_concentracao`)
- **UI:** `specs/UI_SPEC.md` §14.1 (Configurações → limites)
- **Erros:** `specs/ERROR_CATALOG.md` §9 (`RISCO_LIMITE_INVALIDO`)
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Depende de `posicao_ativo`, `ativo` (gestor/segmento) e `investimento_renda_fixa` (instituição) — todos existentes.
- Sem cotação, a concentração por ativo usa o custo; isso é aceitável na Fase 1 e muda quando a Fase 3 entrar.
- Limites por gestora dependem do campo `gestor` preenchido no ativo; ativos sem gestor entram como "não informado" e não são alertados.
- A tela `/configuracoes` é nova; precisa entrar na navegação e no middleware.
