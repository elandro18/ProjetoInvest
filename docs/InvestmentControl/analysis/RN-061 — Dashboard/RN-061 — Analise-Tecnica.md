---
project: INVESTMENT CONTROL
module: dashboard
audience: [tecnica]
status: draft
---

# RN-061 — Dashboard

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

Camada de apresentação agregadora: consome carteira, alocação, rendimentos e watchlist e monta o painel inicial. Não cria cálculo financeiro novo — reutiliza os módulos de carteira e alocação. Cada bloco é um endpoint ou uma consulta independente para permitir degradação parcial.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-061 | ProjetoInvest | `GET /api/dashboard`, `/dashboard` |
| RN-062 | ProjetoInvest | Dados dos seis gráficos |
| RN-063 | ProjetoInvest | Painel de oportunidades |
| RN-020 | ProjetoInvest | Consome `GET /api/carteira` |
| RN-021 | ProjetoInvest | Consome `GET /api/alocacao/desvios` |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Um endpoint agregado com flags por bloco | Menos round-trips na primeira tela |
| 2 | Blocos independentes com erro isolado | Cumpre RN-073 e evita tela branca |
| 3 | Gráficos recebem série pronta do backend | Evita cálculo no cliente e mantém precisão decimal |
| 4 | Carteira vazia → estado vazio, não zeros | Evita leitura errada de patrimônio zero |
| 5 | Dados de watchlist e sugestão degradam para aviso quando indisponíveis | Fase 2/4 podem não estar implementadas |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §5, §7, §8, §10
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.5–§4.14
- **UI:** `specs/UI_SPEC.md` §4, §15 (componentes), §17 (estados)
- **Erros:** `specs/ERROR_CATALOG.md` §2
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Depende de RN-020 (carteira) e RN-021 (alocação); sem elas, o painel não tem o que mostrar.
- Watchlist (RN-048) e sugestão de aporte (RN-025) são de fases seguintes: o bloco precisa existir em estado "em breve", não quebrado.
- Cuidado com hidratação: dados formatados no servidor e no cliente devem coincidir (`Intl` com locale fixo).
